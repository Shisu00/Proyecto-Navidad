import { describe, expect, it } from "vitest";
import {
  buildSubmitInput,
  buildUpdateInput,
  EMPTY_INSCRIPTION_VALUES,
  hasChanges,
  validateInscription,
  valuesFromRow,
} from "./inscriptionForm.js";
import { canCorrectInscription, getReviewActions, isReasonRequired } from "./inscriptionRules.js";

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

describe("corrección de inscripciones", () => {
  const row = {
    beneficiary_id_type: "RUT",
    beneficiary_id_number: "123456785",
    sex: "FEMALE",
    birth_date: "2021-03-10",
    guardian_full_name: "Ana Pérez",
    guardian_id_number: "111111111",
    guardian_email: null,
    guardian_phone: null,
  };

  it("precarga el formulario con los datos guardados", () => {
    const values = valuesFromRow(row);
    expect(values.guardianEmail).toBe("");
    expect(hasChanges(values, row)).toBe(false);
  });

  it("detecta cambios aunque cambie el formato del RUT", () => {
    const values = { ...valuesFromRow(row), idNumber: "12.345.678-5" };
    expect(hasChanges(values, row)).toBe(false);
    expect(hasChanges({ ...values, guardianName: "Ana Pérez Soto" }, row)).toBe(true);
    expect(hasChanges({ ...values, birthDate: "2020-01-01" }, row)).toBe(true);
  });

  it("arma la entrada normalizada con el motivo", () => {
    const input = buildUpdateInput({
      inscriptionId: "i1",
      values: { ...valuesFromRow(row), guardianName: " Ana ", guardianEmail: "" },
      reason: "Error de digitación",
    });
    expect(input).toMatchObject({
      inscriptionId: "i1",
      reason: "Error de digitación",
      beneficiaryIdNumber: "123456785",
      guardianFullName: "Ana",
      guardianEmail: null,
      duplicateJustification: null,
    });
  });
});

describe("canCorrectInscription", () => {
  it("no permite corregir descartadas ni entregadas", () => {
    expect(canCorrectInscription({ displayStatus: "DISCARDED", campaignStatus: "DELIVERY" })).toBe(false);
    expect(canCorrectInscription({ displayStatus: "DELIVERED", campaignStatus: "DELIVERY" })).toBe(false);
  });

  it("depende del estado de la campaña", () => {
    expect(canCorrectInscription({ displayStatus: "REGISTERED", campaignStatus: "PLANNED" })).toBe(false);
    expect(canCorrectInscription({ displayStatus: "REGISTERED", campaignStatus: "CLOSED" })).toBe(false);
    expect(canCorrectInscription({ displayStatus: "IN_REVIEW", campaignStatus: "REGISTRATION_OPEN" })).toBe(true);
  });
});
