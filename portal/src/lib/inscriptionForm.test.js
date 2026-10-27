import { describe, expect, it } from "vitest";
import { buildSubmitInput, EMPTY_INSCRIPTION_VALUES, validateInscription } from "./inscriptionForm.js";
import { getReviewActions, isReasonRequired } from "./inscriptionRules.js";

const validValues = {
  ...EMPTY_INSCRIPTION_VALUES,
  idNumber: "12.345.678-5",
  sex: "FEMALE",
  birthDate: "2021-03-10",
  guardianName: "  Ana Pérez ",
  guardianIdNumber: "11.111.111-1",
};

describe("validateInscription", () => {
  it("no reporta errores con datos válidos", () => {
    expect(validateInscription(validValues, "2026-10-26")).toEqual({});
  });

  it("reporta campos obligatorios y RUT inválido", () => {
    const errors = validateInscription(EMPTY_INSCRIPTION_VALUES, "2026-10-26");
    expect(errors.idNumber).toBe("REQUIRED");
    expect(errors.sex).toBe("REQUIRED");
    expect(errors.guardianIdNumber).toBe("REQUIRED");
    const invalid = validateInscription({ ...validValues, idNumber: "12.345.678-9" }, "2026-10-26");
    expect(invalid.idNumber).toBe("INVALID_RUT");
  });

  it("rechaza fecha futura y correo mal formado", () => {
    const errors = validateInscription(
      { ...validValues, birthDate: "2027-01-01", guardianEmail: "x" },
      "2026-10-26",
    );
    expect(errors.birthDate).toBe("FUTURE_DATE");
    expect(errors.guardianEmail).toBe("INVALID_EMAIL");
  });
});

describe("buildSubmitInput", () => {
  it("normaliza identificaciones y limpia textos opcionales", () => {
    const input = buildSubmitInput({
      operationId: "op-1",
      campaignId: "camp-1",
      values: validValues,
      justification: null,
    });
    expect(input.beneficiaryIdNumber).toBe("123456785");
    expect(input.guardianFullName).toBe("Ana Pérez");
    expect(input.guardianEmail).toBeNull();
    expect(input.duplicateJustification).toBeNull();
  });
});

describe("inscriptionRules", () => {
  it("respeta las transiciones permitidas", () => {
    expect(getReviewActions("PENDING", false)).toEqual(["VALIDATE", "OBSERVE", "DISCARD"]);
    expect(getReviewActions("OBSERVED", false)).toEqual(["VALIDATE", "DISCARD"]);
    expect(getReviewActions("DISCARDED", false)).toEqual([]);
  });

  it("no permite observar ni descartar con entrega vigente", () => {
    expect(getReviewActions("VALIDATED", true)).toEqual([]);
  });

  it("exige motivo salvo validar una pendiente", () => {
    expect(isReasonRequired("PENDING", "VALIDATE")).toBe(false);
    expect(isReasonRequired("OBSERVED", "VALIDATE")).toBe(true);
    expect(isReasonRequired("PENDING", "DISCARD")).toBe(true);
  });
});
