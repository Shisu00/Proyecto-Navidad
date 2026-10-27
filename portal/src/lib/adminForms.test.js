import { describe, expect, it } from "vitest";
import {
  assignableRoles,
  filterUsers,
  groupGrants,
  sameSet,
  userStatus,
  validateCampaign,
  validateNewUser,
  validateRole,
} from "./adminForms.js";

const baseUser = { email: "a@b.cl", fullName: "Ana", roleId: "r1", territoryId: "", councilId: "" };

describe("validateNewUser", () => {
  it("acepta un rol sin JJVV con los datos básicos", () => {
    expect(validateNewUser(baseUser, { requiresCouncil: false })).toEqual({});
  });

  it("exige territorio y JJVV si el rol los requiere", () => {
    const errors = validateNewUser(baseUser, { requiresCouncil: true });
    expect(errors).toEqual({ territoryId: "REQUIRED", councilId: "REQUIRED" });
  });

  it("rechaza correos mal formados y campos vacíos", () => {
    const errors = validateNewUser(
      { ...baseUser, email: "sin-arroba", fullName: " ", roleId: "" },
      { requiresCouncil: false },
    );
    expect(errors).toEqual({ email: "INVALID_EMAIL", fullName: "REQUIRED", roleId: "REQUIRED" });
  });
});

describe("validateRole", () => {
  it("valida el código solo al crear", () => {
    expect(validateRole({ code: "mi rol", name: "X" }, { isNew: true })).toEqual({
      code: "INVALID_CODE",
    });
    expect(validateRole({ code: "", name: "X" }, { isNew: false })).toEqual({});
    expect(validateRole({ code: "mi_rol", name: "X" }, { isNew: true })).toEqual({});
  });
});

describe("validateCampaign", () => {
  it("exige año en rango, nombre y fecha de corte", () => {
    expect(validateCampaign({ year: "1999", name: "", ageCutoffDate: "" })).toEqual({
      year: "INVALID_YEAR",
      name: "REQUIRED",
      ageCutoffDate: "REQUIRED",
    });
    expect(validateCampaign({ year: "2026", name: "Navidad", ageCutoffDate: "2026-12-31" })).toEqual({});
  });
});

describe("assignableRoles", () => {
  const roles = [
    { id: "a", is_active: true, requires_council: false },
    { id: "b", is_active: true, requires_council: true },
    { id: "c", is_active: false, requires_council: true },
  ];

  it("con role.manage ofrece todos los roles activos", () => {
    expect(assignableRoles(roles, (code) => code === "role.manage").map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("sin role.manage solo ofrece roles territoriales activos", () => {
    expect(assignableRoles(roles, () => false).map((r) => r.id)).toEqual(["b"]);
  });
});

describe("usuarios", () => {
  const users = [
    { full_name: "Ana Pérez", email: "ana@x.cl", role_id: "r1", is_active: true, must_change_password: false },
    { full_name: "Luis", email: "luis@x.cl", role_id: "r2", is_active: true, must_change_password: true },
    { full_name: "Eva", email: "eva@x.cl", role_id: "r1", is_active: false, must_change_password: false },
  ];

  it("deriva el estado de la cuenta", () => {
    expect(users.map(userStatus)).toEqual(["ACTIVE", "MUST_CHANGE", "INACTIVE"]);
  });

  it("filtra por texto, rol y estado", () => {
    expect(filterUsers(users, { search: "ANA", roleId: "", status: "" })).toHaveLength(1);
    expect(filterUsers(users, { search: "", roleId: "r1", status: "" })).toHaveLength(2);
    expect(filterUsers(users, { search: "", roleId: "", status: "INACTIVE" })).toHaveLength(1);
  });
});

describe("permisos de rol", () => {
  it("agrupa por rol y compara conjuntos", () => {
    const grouped = groupGrants([
      { role_id: "r1", permission_code: "a.read" },
      { role_id: "r1", permission_code: "b.read" },
      { role_id: "r2", permission_code: "a.read" },
    ]);
    expect(grouped.get("r1")).toEqual(new Set(["a.read", "b.read"]));
    expect(sameSet(grouped.get("r1"), new Set(["b.read", "a.read"]))).toBe(true);
    expect(sameSet(grouped.get("r2"), grouped.get("r1"))).toBe(false);
  });
});
