import { describe, expect, it } from "vitest";
import { getSideNavItems, getTopNavItems } from "./navigation.js";

const canWith = (...permissions) => (permission) => permissions.includes(permission);
const keys = (items) => items.map((item) => item.key);

describe("navegación", () => {
  it("la barra superior va en el orden Resumen, Nueva inscripción, Inscripciones, Entrega", () => {
    const can = canWith(
      "inscription.create",
      "inscription.read_own_council",
      "delivery.confirm",
    );
    expect(keys(getTopNavItems(can))).toEqual([
      "dashboard",
      "newInscription",
      "inscriptions",
      "delivery",
    ]);
  });

  it("la barra lateral completa va en el orden pedido", () => {
    const can = canWith(
      "catalog.manage",
      "role.manage",
      "user.manage",
      "planning.read",
      "data.export",
      "audit.read",
    );
    expect(keys(getSideNavItems(can))).toEqual([
      "catalogs",
      "roles",
      "users",
      "campaign",
      "analytics",
      "reports",
      "audit",
    ]);
  });

  it("una cuenta de JJVV no tiene barra lateral", () => {
    const can = canWith("inscription.create", "inscription.read_own_council", "delivery.confirm");
    expect(getSideNavItems(can)).toEqual([]);
  });

  it("la barra lateral muestra solo lo que el permiso habilita", () => {
    const can = canWith("user.read", "planning.read", "data.export", "audit.read");
    expect(keys(getSideNavItems(can))).toEqual(["users", "analytics", "reports", "audit"]);
  });
});
