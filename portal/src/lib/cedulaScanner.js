import { isValidRut, normalizeRut } from "./rut.js";

export const SCAN_FORMATS = Object.freeze(["qr_code", "pdf417"]);

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

export function isScannerSupported() {
  return (
    typeof globalThis.BarcodeDetector === "function" &&
    Boolean(globalThis.navigator?.mediaDevices?.getUserMedia)
  );
}

// Si un solo formato no está soportado el constructor falla: se filtra de antemano
export async function createDetector() {
  const supported = (await globalThis.BarcodeDetector.getSupportedFormats?.()) ?? SCAN_FORMATS;
  const formats = SCAN_FORMATS.filter((format) => supported.includes(format));
  if (formats.length === 0) throw new Error("NO_SUPPORTED_FORMATS");
  return new globalThis.BarcodeDetector({ formats });
}
