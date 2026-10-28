import { changedFields, summarizeAuditEntry } from "./auditLog.js";
import { enumLabels, labels } from "./labels.js";

const MAX_VALUE_LENGTH = 120;

export function formatChangeValue(field, value) {
  if (value === null || value === undefined || value === "") return labels.audit.emptyValue;
  if (typeof value === "boolean") return value ? labels.app.yes : labels.app.no;
  if (field === "status") {
    const known = enumLabels.inscriptionStatus?.[value] ?? enumLabels.campaignStatus?.[value];
    if (known) return known;
  }
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  return text.length > MAX_VALUE_LENGTH ? `${text.slice(0, MAX_VALUE_LENGTH)}…` : text;
}

export function changeLine(change) {
  const name = labels.audit.fields[change.field] ?? change.field;
  return `${name}: ${formatChangeValue(change.field, change.before)} → ${formatChangeValue(change.field, change.after)}`;
}

export function entryChanges(entry) {
  return changedFields(entry.previous_state, entry.new_state);
}

// Resumen de una línea para entregas y cambios de campaña; null si no aplica
export function summaryText(entry, councilNames) {
  const summary = summarizeAuditEntry(entry);
  if (summary?.type === "delivery") {
    const typeLabel = enumLabels.withdrawalType[summary.withdrawalType] ?? "";
    return labels.audit.deliverySummary(typeLabel, councilNames.get(summary.councilId) ?? "");
  }
  if (summary?.type === "campaign") {
    return labels.audit.campaignSummary(
      enumLabels.campaignStatus[summary.from] ?? summary.from,
      enumLabels.campaignStatus[summary.to] ?? summary.to,
    );
  }
  if (entry.action === "AUDIT_EXPORTED" || entry.action === "DATA_EXPORTED") {
    return labels.audit.exportSummary(entry.new_state?.row_count ?? 0);
  }
  return null;
}

export function actorText(entry) {
  if (entry.actorName) return entry.actorName;
  return entry.actor_user_id ? labels.audit.unknownActor : labels.audit.systemActor;
}
