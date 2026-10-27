// Categorías del visor de auditoría. Una acción pertenece a una sola categoría;
// lo que no figura aquí (casos de calidad, exportaciones, acciones por defecto del
// trigger) cae en OTHER.
export const OTHER_CATEGORY = "OTHER";

export const AUDIT_CATEGORIES = Object.freeze({
  INSCRIPTIONS: [
    "INSCRIPTIONS_INSERT",
    "INSCRIPTION_DUPLICATE_JUSTIFIED",
    "INSCRIPTION_AUTO_VALIDATED",
    "INSCRIPTION_DUPLICATE_AUTO_VALIDATED",
    "INSCRIPTION_AUTO_OBSERVED",
    "INSCRIPTION_VALIDATED",
    "INSCRIPTION_OBSERVED",
    "INSCRIPTION_DISCARDED",
    "INSCRIPTION_CORRECTED",
  ],
  DELIVERIES: ["DELIVERY_CONFIRMED", "DELIVERY_VOIDED"],
  ACCOUNTS: [
    "USER_CREATED",
    "USER_DEACTIVATED",
    "USER_REACTIVATED",
    "PASSWORD_RESET_ISSUED",
    "PASSWORD_CHANGED",
  ],
  CAMPAIGNS: ["CAMPAIGN_STATUS_CHANGED", "CATALOG_CHANGED"],
  ROLES: ["ROLE_CHANGED", "ROLE_PERMISSIONS_CHANGED"],
});

export const CATEGORY_ORDER = Object.freeze([...Object.keys(AUDIT_CATEGORIES), OTHER_CATEGORY]);

export const KNOWN_ACTIONS = Object.freeze(Object.values(AUDIT_CATEGORIES).flat());

export function actionsInCategory(category) {
  return AUDIT_CATEGORIES[category] ?? [];
}

export function categoryOfAction(action) {
  const found = Object.entries(AUDIT_CATEGORIES).find(([, actions]) => actions.includes(action));
  return found ? found[0] : OTHER_CATEGORY;
}
