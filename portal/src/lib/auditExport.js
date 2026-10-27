import { auditReasonText } from "./auditLog.js";
import { categoryOfAction } from "./auditCategories.js";
import { toCsv } from "./csv.js";
import { actorText, changeLine, entryChanges, summaryText } from "./auditText.js";
import { labels } from "./labels.js";

const pad = (value) => String(value).padStart(2, "0");

// Fecha y hora locales en columnas separadas: Excel (es-CL) reconoce dd-mm-aaaa como fecha
export function splitLocalDateTime(isoTimestamp) {
  const date = new Date(isoTimestamp);
  return {
    day: `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`,
  };
}

// Sin estado completo: el CSV no lleva RUN ni datos personales de niños o adultos.
// Solo el resumen, el motivo y los campos que cambiaron.
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
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const slug = categoryLabel
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `auditoria_${slug}_${stamp}.csv`;
}
