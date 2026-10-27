import { describe, expect, it } from "vitest";
import { auditReasonText, changedFields, summarizeAuditEntry } from "./auditLog.js";

describe("changedFields", () => {
  it("devuelve solo los campos que cambiaron e ignora updated_at", () => {
    const previous = { status: "PENDING", sex: "FEMALE", updated_at: "a" };
    const next = { status: "VALIDATED", sex: "FEMALE", updated_at: "b" };
    expect(changedFields(previous, next)).toEqual([
      { field: "status", before: "PENDING", after: "VALIDATED" },
    ]);
  });

  it("no compara un alta ni una baja", () => {
    expect(changedFields(null, { status: "PENDING" })).toEqual([]);
    expect(changedFields({ status: "PENDING" }, null)).toEqual([]);
  });
});

describe("summarizeAuditEntry", () => {
  it("resume entregas con tipo de retiro y JJVV", () => {
    const entry = {
      action: "DELIVERY_CONFIRMED",
      new_state: { withdrawal_type: "SUBSIDIARY", council_id: "c1" },
    };
    expect(summarizeAuditEntry(entry)).toEqual({
      type: "delivery",
      withdrawalType: "SUBSIDIARY",
      councilId: "c1",
    });
  });

  it("resume el cambio de estado de campaña", () => {
    const entry = {
      action: "CAMPAIGN_STATUS_CHANGED",
      previous_state: { status: "PLANNED" },
      new_state: { status: "REGISTRATION_OPEN" },
    };
    expect(summarizeAuditEntry(entry)).toEqual({
      type: "campaign",
      from: "PLANNED",
      to: "REGISTRATION_OPEN",
    });
  });

  it("devuelve null para el resto de las acciones", () => {
    expect(summarizeAuditEntry({ action: "PASSWORD_CHANGED", new_state: {} })).toBeNull();
  });
});

describe("auditReasonText", () => {
  it("quita el tipo de retiro del motivo de una entrega", () => {
    expect(auditReasonText({ action: "DELIVERY_CONFIRMED", reason: "STANDARD" })).toBeNull();
    expect(
      auditReasonText({ action: "DELIVERY_CONFIRMED", reason: "SUBSIDIARY: Retira la abuela" }),
    ).toBe("Retira la abuela");
  });

  it("devuelve el motivo tal cual en las demás acciones", () => {
    expect(auditReasonText({ action: "DELIVERY_VOIDED", reason: "Error de digitación" })).toBe(
      "Error de digitación",
    );
    expect(auditReasonText({ action: "DELIVERY_VOIDED", reason: null })).toBeNull();
  });
});
