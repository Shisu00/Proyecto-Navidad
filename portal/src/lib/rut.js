export function normalizeRut(value) {
  return String(value ?? "")
    .replace(/[^0-9kK]/g, "")
    .toUpperCase();
}

function expectedCheckDigit(body) {
  let sum = 0;
  let factor = 2;
  for (let index = body.length - 1; index >= 0; index -= 1) {
    sum += Number(body[index]) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const remainder = 11 - (sum % 11);
  if (remainder === 11) return "0";
  if (remainder === 10) return "K";
  return String(remainder);
}

// Espejo de private.is_valid_rut: cuerpo de 7 a 8 dígitos y módulo 11
export function isValidRut(value) {
  const normalized = normalizeRut(value);
  if (!/^[0-9]{7,8}[0-9K]$/.test(normalized)) return false;
  return normalized.slice(-1) === expectedCheckDigit(normalized.slice(0, -1));
}

export function formatRut(value) {
  const normalized = normalizeRut(value);
  if (normalized.length < 2) return normalized;
  const body = normalized.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${body}-${normalized.slice(-1)}`;
}
