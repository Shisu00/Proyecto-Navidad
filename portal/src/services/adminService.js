import { supabase } from "../lib/supabaseClient.js";
import { callRpc, unwrap } from "./rpc.js";
import { parseFunctionError } from "./functionError.js";

// ---- Cuentas

export async function listUsers() {
  return (await callRpc("admin_list_users")) ?? [];
}

// La clave temporal viaja una sola vez en la respuesta: no se guarda en ningún lado
async function invokeCredentials(body) {
  const { data, error } = await supabase.functions.invoke("admin-credentials", { body });
  if (error) throw await parseFunctionError(error);
  return { userId: data.user_id, temporaryPassword: data.temporary_password };
}

export function createUser({ email, fullName, roleId, territoryId, councilId }) {
  return invokeCredentials({
    action: "create_user",
    email,
    full_name: fullName,
    role_id: roleId,
    territory_id: territoryId || null,
    council_id: councilId || null,
  });
}

export function resetPassword({ userId }) {
  return invokeCredentials({ action: "reset_password", user_id: userId });
}

export function setProfileActive({ userId, active, reason }) {
  return callRpc("admin_set_profile_active", {
    p_user_id: userId,
    p_active: active,
    p_reason: reason,
  });
}

// ---- Catálogos

export function upsertTerritory({ id, name }) {
  return callRpc("admin_upsert_territory", { p_name: name, p_id: id ?? null });
}

export function upsertCouncil({ id, territoryId, name }) {
  return callRpc("admin_upsert_council", {
    p_territory_id: territoryId,
    p_name: name,
    p_id: id ?? null,
  });
}

export function upsertCampaign({ id, year, name, ageCutoffDate, autoValidate }) {
  return callRpc("admin_upsert_campaign", {
    p_year: year,
    p_name: name,
    p_age_cutoff_date: ageCutoffDate,
    p_auto_validate: autoValidate,
    p_id: id ?? null,
  });
}

export function setCatalogActive({ entity, id, active }) {
  return callRpc("admin_set_catalog_active", { p_entity: entity, p_id: id, p_active: active });
}

// ---- Roles

export async function fetchRoleCatalog() {
  const [roles, permissions, grants] = await Promise.all([
    supabase
      .from("roles")
      .select("id, code, name, is_system, is_active, requires_council")
      .order("name"),
    supabase.from("permissions").select("code, description").order("code"),
    supabase.from("role_permissions").select("role_id, permission_code"),
  ]);

  return {
    roles: unwrap(roles) ?? [],
    permissions: unwrap(permissions) ?? [],
    grants: unwrap(grants) ?? [],
  };
}

export function upsertRole({ id, code, name, requiresCouncil }) {
  return callRpc("admin_upsert_role", {
    p_code: code ?? "",
    p_name: name,
    p_requires_council: requiresCouncil,
    p_id: id ?? null,
  });
}

export function setRolePermissions({ roleId, permissionCodes }) {
  return callRpc("admin_set_role_permissions", {
    p_role_id: roleId,
    p_permission_codes: permissionCodes,
  });
}

export function setRoleActive({ roleId, active }) {
  return callRpc("admin_set_role_active", { p_role_id: roleId, p_active: active });
}
