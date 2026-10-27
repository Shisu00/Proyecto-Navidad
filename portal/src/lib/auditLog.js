const IGNORED_FIELDS = new Set(["updated_at"]);

export const AUDIT_ACTIONS = Object.freeze([
  "INSCRIPTIONS_INSERT",
  "INSCRIPTION_DUPLICATE_JUSTIFIED",
  "INSCRIPTION_AUTO_VALIDATED",
  "INSCRIPTION_DUPLICATE_AUTO_VALIDATED",
  "INSCRIPTION_AUTO_OBSERVED",
  "INSCRIPTION_VALIDATED",
  "INSCRIPTION_OBSERVED",
  "INSCRIPTION_DISCARDED",
  "DELIVERY_CONFIRMED",
  "DELIVERY_VOIDED",
  "USER_CREATED",
  "USER_DEACTIVATED",
  "USER_REACTIVATED",
  "PASSWORD_RESET_ISSUED",
  "PASSWORD_CHANGED",
  "CAMPAIGN_STATUS_CHANGED",
  "CATALOG_CHANGED",
  "ROLE_PERMISSIONS_CHANGED",
]);

// Solo los campos que cambiaron: un alta no tiene estado anterior con qué comparar
export function changedFields(previousState, newState) {
  if (!previousState || !newState) return [];
  return Object.keys(newState)
    .filter((field) => !IGNORED_FIELDS.has(field))
    .filter((field) => JSON.stringify(previousState[field]) !== JSON.stringify(newState[field]))
    .map((field) => ({
      field,
      before: previousState[field] ?? null,
      after: newState[field] ?? null,
    }));
}

export function summarizeAuditEntry(entry) {
  const state = entry.new_state ?? {};
  if (entry.action === "DELIVERY_CONFIRMED" || entry.action === "DELIVERY_VOIDED") {
    return {
      type: "delivery",
      withdrawalType: state.withdrawal_type ?? null,
      councilId: state.council_id ?? null,
    };
  }
  if (entry.action === "CAMPAIGN_STATUS_CHANGED") {
    return {
      type: "campaign",
      from: entry.previous_state?.status ?? null,
      to: state.status ?? null,
    };
  }
  return null;
}

// En DELIVERY_CONFIRMED el motivo guarda "TIPO" o "TIPO: observación"; solo interesa lo segundo
export function auditReasonText(entry) {
  if (!entry.reason) return null;
  if (entry.action !== "DELIVERY_CONFIRMED") return entry.reason;
  const separator = entry.reason.indexOf(": ");
  return separator === -1 ? null : entry.reason.slice(separator + 2);
}

export function shortId(entityId) {
  return String(entityId ?? "").slice(0, 8);
}
