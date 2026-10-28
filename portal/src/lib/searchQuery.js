import { normalizeIdNumber } from "./identification.js";

export const MIN_SEARCH_LENGTH = 3;

// Texto que solo tiene dígitos, puntos, guion, espacios y K: se trata como RUN o IPE
const IDENTIFICATION_TEXT = /^[\d.\-\sKk]*$/;

// Minúsculas y sin tildes ni eñes, igual que guardian_search_name en la base de datos
export function normalizeSearchName(text) {
  return String(text ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Convierte lo que escribe el usuario en la búsqueda que entiende el servicio:
// un RUN/IPE normalizado (dígitos y K mayúscula) o un nombre normalizado (minúsculas).
// Devuelve "" si todavía es muy corto para buscar.
export function parseSearchText(text) {
  const trimmed = String(text ?? "").trim();
  const query = IDENTIFICATION_TEXT.test(trimmed)
    ? normalizeIdNumber(trimmed)
    : normalizeSearchName(trimmed);
  return query.length >= MIN_SEARCH_LENGTH ? query : "";
}

// Una búsqueda normalizada de identificación solo tiene dígitos y K mayúscula
export function isNameSearch(search) {
  return /[^0-9K]/.test(search);
}

export function isIdentificationQuery(text) {
  return IDENTIFICATION_TEXT.test(String(text ?? "").trim());
}
