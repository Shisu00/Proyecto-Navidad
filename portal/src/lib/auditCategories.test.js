import { describe, expect, it } from "vitest";
import {
  actionsInCategory,
  AUDIT_CATEGORIES,
  categoryOfAction,
  KNOWN_ACTIONS,
  OTHER_CATEGORY,
} from "./auditCategories.js";
import { dateRangeToIso } from "./auditLog.js";

describe("categorías de auditoría", () => {
  it("cada acción pertenece a una sola categoría", () => {
    expect(new Set(KNOWN_ACTIONS).size).toBe(KNOWN_ACTIONS.length);
  });

  it("clasifica acciones conocidas y manda el resto a Otros", () => {
    expect(categoryOfAction("DELIVERY_VOIDED")).toBe("DELIVERIES");
    expect(categoryOfAction("INSCRIPTION_CORRECTED")).toBe("INSCRIPTIONS");
    expect(categoryOfAction("QUALITY_CASE_RESOLVED")).toBe(OTHER_CATEGORY);
    expect(categoryOfAction("AUDIT_EXPORTED")).toBe(OTHER_CATEGORY);
  });

  it("lista las acciones de una categoría", () => {
    expect(actionsInCategory("ROLES")).toEqual(AUDIT_CATEGORIES.ROLES);
    expect(actionsInCategory(OTHER_CATEGORY)).toEqual([]);
  });
});

describe("dateRangeToIso", () => {
  it("devuelve null para los extremos vacíos", () => {
    expect(dateRangeToIso({ from: "", to: "" })).toEqual({ fromIso: null, toIso: null });
  });

  it("el límite superior es el inicio del día siguiente (exclusivo)", () => {
    const { fromIso, toIso } = dateRangeToIso({ from: "2026-10-27", to: "2026-10-27" });
    expect(new Date(toIso).getTime()).toBeGreaterThan(new Date(fromIso).getTime());
    expect(new Date(fromIso).getDate()).toBe(27);
    expect(new Date(toIso).getDate()).toBe(28);
  });
});
