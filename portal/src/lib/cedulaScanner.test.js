import { describe, expect, it } from "vitest";
import { extractRun, firstRun } from "./cedulaScanner.js";

describe("extractRun", () => {
  it("lee el RUN del parámetro de la URL del QR", () => {
    const url = "https://portal.sidiv.registrocivil.cl/docstatus?RUN=12345678-5&type=CEDULA&serial=1";
    expect(extractRun(url)).toBe("123456785");
  });

  it("lee el RUN con el patrón NNNNNNNN-D en otros contenidos", () => {
    expect(extractRun("12345678-5 PEREZ GONZALEZ")).toBe("123456785");
  });

  it("acepta el RUN sin guion si el dígito verificador es válido", () => {
    expect(extractRun("123456785 PEREZ")).toBe("123456785");
  });

  it("devuelve null con dígito verificador inválido o sin RUN", () => {
    expect(extractRun("RUN=12345678-9")).toBeNull();
    expect(extractRun("sin datos")).toBeNull();
    expect(extractRun(undefined)).toBeNull();
  });
});

describe("firstRun", () => {
  it("devuelve el primer texto con un RUN válido", () => {
    expect(firstRun(["otro código", "https://x.cl/docstatus?RUN=12345678-5&type=CEDULA"])).toBe(
      "123456785",
    );
  });

  it("devuelve null si ningún texto trae un RUN válido", () => {
    expect(firstRun(["abc", "RUN=12345678-9"])).toBeNull();
    expect(firstRun([])).toBeNull();
  });
});
