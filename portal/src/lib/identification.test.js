import { describe, expect, it } from "vitest";
import { isValidIdNumber, isValidIpe } from "./identification.js";

describe("identification", () => {
  it("acepta el IPE de ejemplo oficial por estructura", () => {
    expect(isValidIpe("100.111.222-2")).toBe(true);
  });

  it("rechaza IPE con largo incorrecto o letras", () => {
    expect(isValidIpe("12345")).toBe(false);
    expect(isValidIpe("100111222K")).toBe(false);
  });

  it("valida según el tipo", () => {
    expect(isValidIdNumber("RUT", "12.345.678-5")).toBe(true);
    expect(isValidIdNumber("IPE", "12.345.678-5")).toBe(false);
    expect(isValidIdNumber("OTHER", "1")).toBe(false);
  });
});
