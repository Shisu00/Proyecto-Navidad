const IGNORED_FIELDS = new Set(["updated_at"]);

export { KNOWN_ACTIONS as AUDIT_ACTIONS } from "./auditCategories.js";

export const SYSTEM_ACTOR = "__SYSTEM__";

// Rango de fechas del filtro (día calendario local) a instantes ISO: [desde, hasta)
export function dateRangeToIso({ from, to }) {
  const toIso = (day, offsetDays) => {
    if (!day) return null;
    const [year, month, date] = day.split("-").map(Number);
    return new Date(year, month - 1, date + offsetDays).toISOString();
  };
  return { fromIso: toIso(from, 0), toIso: toIso(to, 1) };
}

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
