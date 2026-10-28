import { isValidRut, normalizeRut } from "./rut.js";
import { decodeWithZxing } from "./zxingDecoder.js";

export const SCAN_FORMATS = Object.freeze(["qr_code", "pdf417"]);
// La foto se decodifica ya reducida: una foto completa de teléfono ocupa decenas de MB
// y, con la cámara abierta, puede agotar la memoria y cerrar la página
const PHOTO_DECODE_WIDTH = 2400;
const PHOTO_MAX_SIDES = Object.freeze([2400, 1400]);

// QR de la cédula nueva: URL con ?RUN=NNNNNNNN-D. PDF417 y otros: patrón NNNNNNNN-D
const RUN_PARAM = /[?&]RUN=(\d{7,8}-?[\dkK])/i;
const RUN_PATTERN = /\b(\d{7,8})-([\dkK])\b/;
// Sin guion: el módulo 11 de extractRun descarta los falsos positivos
const RUN_COMPACT = /\b(\d{7,8})([\dkK])\b/;

function findRunCandidate(text) {
  const param = text.match(RUN_PARAM);
  if (param) return param[1];
  const pattern = text.match(RUN_PATTERN);
  if (pattern) return `${pattern[1]}-${pattern[2]}`;
  const compact = text.match(RUN_COMPACT);
  return compact ? `${compact[1]}-${compact[2]}` : null;
}

// Se descarta el contenido crudo del código: solo se conserva el RUN (SPECS §8.4)
export function extractRun(rawValue) {
  const candidate = findRunCandidate(String(rawValue ?? ""));
  if (!candidate) return null;
  const run = normalizeRut(candidate);
  return isValidRut(run) ? run : null;
}

// Cámara en vivo: necesita acceso a la cámara, pero ya no depende de BarcodeDetector
export function isScannerSupported() {
  return Boolean(globalThis.navigator?.mediaDevices?.getUserMedia);
}

// Si un solo formato no está soportado el constructor falla: se filtra de antemano
async function createNativeDetector() {
  if (typeof globalThis.BarcodeDetector !== "function") return null;
  try {
    const supported = (await globalThis.BarcodeDetector.getSupportedFormats?.()) ?? SCAN_FORMATS;
    const formats = SCAN_FORMATS.filter((format) => supported.includes(format));
    return formats.length > 0
      ? { detector: new globalThis.BarcodeDetector({ formats }), formats }
      : null;
  } catch {
    return null;
  }
}

// Lector de códigos: primero el del navegador (rápido) y, si no encuentra nada, ZXing.
// read() devuelve los textos leídos; extractRun decide cuál trae un RUN válido.
export async function createCodeReader() {
  const native = await createNativeDetector();
  return {
    nativeFormats: native?.formats ?? [],
    async read(source, { maxSide = 1920, useFallback = true } = {}) {
      if (native) {
        try {
          const codes = await native.detector.detect(source);
          if (codes.length > 0) return codes.map((code) => code.rawValue);
        } catch {
          // El detector falla mientras la cámara aún no entrega imagen: se prueba el respaldo
        }
      }
      return useFallback ? decodeWithZxing(source, { maxSide }) : [];
    },
  };
}

export function firstRun(values) {
  for (const value of values) {
    const run = extractRun(value);
    if (run) return run;
  }
  return null;
}

// Foto tomada con la cámara del teléfono: se prueba a dos escalas porque el tamaño ideal
// depende de cuánto ocupe el código en la imagen
export async function readRunFromImage(file) {
  const reader = await createCodeReader();
  const bitmap = await createImageBitmap(file, {
    resizeWidth: PHOTO_DECODE_WIDTH,
    resizeQuality: "high",
  });
  try {
    for (const maxSide of PHOTO_MAX_SIDES) {
      const run = firstRun(await reader.read(bitmap, { maxSide }));
      if (run) return run;
    }
    return null;
  } finally {
    bitmap.close();
  }
}
