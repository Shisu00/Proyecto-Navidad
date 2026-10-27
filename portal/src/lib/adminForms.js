// Mismo patrón que guardians_email_format
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const MIN_YEAR = 2000;
export const MAX_YEAR = 2100;

export const CATALOG_ENTITY = Object.freeze({ TERRITORY: "TERRITORY", COUNCIL: "COUNCIL" });

// Validación local de UX: el servidor vuelve a validar todo
export function validateNewUser(values, { requiresCouncil }) {
  const errors = {};
  const email = values.email.trim();

  if (!email) errors.email = "REQUIRED";
  else if (!EMAIL_PATTERN.test(email)) errors.email = "INVALID_EMAIL";

  if (!values.fullName.trim()) errors.fullName = "REQUIRED";
  if (!values.roleId) errors.roleId = "REQUIRED";
  if (requiresCouncil) {
    if (!values.territoryId) errors.territoryId = "REQUIRED";
    if (!values.councilId) errors.councilId = "REQUIRED";
  }
  return errors;
}

export function validateName(name) {
  return name.trim() ? {} : { name: "REQUIRED" };
}

export function validateRole(values, { isNew }) {
  const errors = validateName(values.name);
  if (isNew) {
    const code = values.code.trim().toUpperCase();
    if (!code) errors.code = "REQUIRED";
    else if (!/^[A-Z][A-Z0-9_]*$/.test(code)) errors.code = "INVALID_CODE";
  }
  return errors;
}

export function validateCampaign(values) {
  const errors = validateName(values.name);
  const year = Number(values.year);
  if (!values.year) errors.year = "REQUIRED";
  else if (!Number.isInteger(year) || year < MIN_YEAR || year > MAX_YEAR) {
    errors.year = "INVALID_YEAR";
  }
  if (!values.ageCutoffDate) errors.ageCutoffDate = "REQUIRED";
  return errors;
}

// Quien solo gestiona usuarios únicamente asigna roles territoriales (SPECS §4.5).
// Es una ayuda de UI: el servidor decide.
export function assignableRoles(roles, can) {
  return roles.filter((role) => role.is_active && (can("role.manage") || role.requires_council));
}

export function canManageUser(user, roles, can) {
  const role = roles.find((item) => item.id === user.role_id);
  return Boolean(role) && (can("role.manage") || role.requires_council);
}

export function userStatus(user) {
  if (!user.is_active) return "INACTIVE";
  if (user.must_change_password) return "MUST_CHANGE";
  return "ACTIVE";
}

export function filterUsers(users, { search, roleId, status }) {
  const needle = search.trim().toLowerCase();
  return users.filter((user) => {
    if (roleId && user.role_id !== roleId) return false;
    if (status && userStatus(user) !== status) return false;
    if (!needle) return true;
    return (
      user.full_name.toLowerCase().includes(needle) || (user.email ?? "").toLowerCase().includes(needle)
    );
  });
}

export function groupGrants(grants) {
  const byRole = new Map();
  for (const { role_id: roleId, permission_code: code } of grants) {
    if (!byRole.has(roleId)) byRole.set(roleId, new Set());
    byRole.get(roleId).add(code);
  }
  return byRole;
}

export function sameSet(first, second) {
  return first.size === second.size && [...first].every((item) => second.has(item));
}
