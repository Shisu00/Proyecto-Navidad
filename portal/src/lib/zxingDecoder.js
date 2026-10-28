// Decodificador de respaldo para cuando el BarcodeDetector del navegador no encuentra el código
// (cámara que enfoca mal, código pequeño, reflejos) o no existe (iPhone, Safari, escritorio).
// ZXing es JavaScript puro: no necesita cambios en la política de seguridad del sitio.
// Se carga bajo demanda para no pesar en el resto del portal.

let libraryPromise = null;
let canvas = null;

function loadLibrary() {
  libraryPromise ??= import("@zxing/library");
  return libraryPromise;
}

// Reduce solo si hace falta: un código pequeño pierde detalle al achicar la imagen
export function fitSize(width, height, maxSide) {
  const largest = Math.max(width, height);
  if (largest <= maxSide) return { width, height };
  const scale = maxSide / largest;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

// Escala de grises con los mismos pesos que usa ZXing
export function toLuminance(rgba, pixelCount) {
  const luminance = new Uint8ClampedArray(pixelCount);
  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    const offset = pixel * 4;
    luminance[pixel] = (306 * rgba[offset] + 601 * rgba[offset + 1] + 117 * rgba[offset + 2]) >> 10;
  }
  return luminance;
}

function sourceSize(source) {
  return {
    width: source.videoWidth || source.naturalWidth || source.width,
    height: source.videoHeight || source.naturalHeight || source.height,
  };
}

// Devuelve el texto de los códigos QR o PDF417 encontrados (lista vacía si no hay ninguno)
export async function decodeWithZxing(source, { maxSide = 1920 } = {}) {
  try {
    const zxing = await loadLibrary();
    const natural = sourceSize(source);
    if (!natural.width || !natural.height) return [];

    const { width, height } = fitSize(natural.width, natural.height, maxSide);
    canvas ??= document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(source, 0, 0, width, height);
    const { data } = context.getImageData(0, 0, width, height);

    const hints = new Map();
    hints.set(zxing.DecodeHintType.POSSIBLE_FORMATS, [
      zxing.BarcodeFormat.QR_CODE,
      zxing.BarcodeFormat.PDF_417,
    ]);
    hints.set(zxing.DecodeHintType.TRY_HARDER, true);

    const luminanceSource = new zxing.RGBLuminanceSource(
      toLuminance(data, width * height),
      width,
      height,
    );
    const bitmap = new zxing.BinaryBitmap(new zxing.HybridBinarizer(luminanceSource));
    const result = new zxing.MultiFormatReader().decode(bitmap, hints);
    return [result.getText()];
  } catch {
    // ZXing lanza una excepción cuando no encuentra nada: es el caso normal en cada cuadro vacío
    return [];
  }
}
