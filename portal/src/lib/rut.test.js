import { describe, expect, it } from "vitest";
import { formatRut, isValidRut, normalizeRut } from "./rut.js";

describe("rut", () => {
  it("normaliza puntos, guion y K minúscula", () => {
    expect(normalizeRut("12.345.678-5")).toBe("123456785");
    expect(normalizeRut("1.234.567-k")).toBe("1234567K");
  });

  it("acepta RUT con dígito verificador correcto", () => {
    expect(isValidRut("12.345.678-5")).toBe(true);
    expect(isValidRut("11111111-1")).toBe(true);
  });

  it("rechaza dígito verificador incorrecto y formatos inválidos", () => {
    expect(isValidRut("12.345.678-9")).toBe(false);
    expect(isValidRut("123")).toBe(false);
    expect(isValidRut("")).toBe(false);
  });

  it("formatea con puntos y guion", () => {
    expect(formatRut("123456785")).toBe("12.345.678-5");
  });
});
