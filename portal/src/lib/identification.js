import { formatRut, isValidRut, normalizeRut } from "./rut.js";

export const ID_TYPES = Object.freeze({ RUT: "RUT", IPE: "IPE" });

export const normalizeIdNumber = normalizeRut;

// Espejo de private.is_valid_ipe: solo estructura, sin módulo 11
export function isValidIpe(value) {
  return /^[0-9]{10}$/.test(normalizeIdNumber(value));
}

export function isValidIdNumber(type, value) {
  if (type === ID_TYPES.RUT) return isValidRut(value);
  if (type === ID_TYPES.IPE) return isValidIpe(value);
  return false;
}

// RUT e IPE comparten el formato visual NNN.NNN.NNN-D
export function formatIdNumber(value) {
  return formatRut(value);
}
