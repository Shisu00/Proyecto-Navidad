import { auditReasonText } from "./auditLog.js";
import { categoryOfAction } from "./auditCategories.js";
import { csvFilename, splitLocalDateTime, toCsv } from "./csv.js";
import { formatIdNumber } from "./identification.js";
import { actorText, changeLine, entryChanges, summaryText } from "./auditText.js";
import { labels } from "./labels.js";

export { splitLocalDateTime };

// RUN/IPE tal como estaba en el registro; si el evento lo cambió, se indica el valor anterior
function runText(current, previous) {
  const now = current ? formatIdNumber(current) : "";
  if (previous && previous !== current) {
    return labels.audit.runChanged(now, formatIdNumber(previous));
  }
  return now;
}

// Sin el estado completo (JSON): resumen, motivo, campos que cambiaron y los RUN involucrados.
// Los RUN vienen resueltos por la vista audit_log_export.
export function auditEntryToCsvRow(entry, { councilNames }) {
  const { day, time } = splitLocalDateTime(entry.occurred_at);
  return [
    day,
    time,
    actorText(entry),
    labels.audit.categories[categoryOfAction(entry.action)],
    labels.audit.actions[entry.action] ?? entry.action,
    labels.audit.entities[entry.entity_type] ?? entry.entity_type,
    entry.entity_id ?? "",
    runText(entry.beneficiary_run, entry.previous_beneficiary_run),
    runText(entry.guardian_run, entry.previous_guardian_run),
    runText(entry.withdrawer_run, null),
    auditReasonText(entry) ?? "",
    summaryText(entry, councilNames) ?? "",
    entryChanges(entry).map(changeLine).join(" | "),
  ];
}

export function buildAuditCsv(entries, context) {
  return toCsv(
    labels.audit.csvHeaders,
    entries.map((entry) => auditEntryToCsvRow(entry, context)),
  );
}

export function auditExportFilename(categoryLabel, now = new Date()) {
  return csvFilename("auditoria", categoryLabel, now);
}
