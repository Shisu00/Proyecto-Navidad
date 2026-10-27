import { auditReasonText, changedFields, shortId, summarizeAuditEntry } from "../lib/auditLog.js";
import { formatDateTime } from "../lib/format.js";
import { enumLabels, labels } from "../lib/labels.js";

const MAX_VALUE_LENGTH = 120;

function formatValue(value) {
  if (value === null || value === undefined || value === "") return labels.audit.emptyValue;
  if (typeof value === "boolean") return value ? labels.app.yes : labels.app.no;
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  return text.length > MAX_VALUE_LENGTH ? `${text.slice(0, MAX_VALUE_LENGTH)}…` : text;
}

function summaryText(summary, councilNames) {
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
  return null;
}

function actorText(entry) {
  if (entry.actorName) return entry.actorName;
  return entry.actor_user_id ? labels.audit.unknownActor : labels.audit.systemActor;
}

export default function AuditRow({ entry, councilNames }) {
  const summary = summaryText(summarizeAuditEntry(entry), councilNames);
  const reason = auditReasonText(entry);
  const changes = changedFields(entry.previous_state, entry.new_state);

  return (
    <tr>
      <td className="cell-audit" data-label={labels.audit.columnDate}>
        {formatDateTime(entry.occurred_at)}
      </td>
      <td className="cell-audit" data-label={labels.audit.columnActor}>
        {actorText(entry)}
      </td>
      <td className="cell-audit" data-label={labels.audit.columnAction}>
        <p className="cell-title">{labels.audit.actions[entry.action] ?? entry.action}</p>
        <p className="cell-sub">
          {labels.audit.entities[entry.entity_type] ?? entry.entity_type} ·{" "}
          {shortId(entry.entity_id)}
        </p>
      </td>
      <td className="cell-audit" data-label={labels.audit.columnDetail}>
        {summary ? <p>{summary}</p> : null}
        {reason ? <p className="cell-sub">{labels.audit.reason(reason)}</p> : null}
        {changes.length > 0 ? (
          <details className="cell-note">
            <summary>{labels.audit.viewChanges(changes.length)}</summary>
            <ul className="audit-changes">
              {changes.map((change) => (
                <li key={change.field}>
                  <strong>{labels.audit.fields[change.field] ?? change.field}</strong>:{" "}
                  {formatValue(change.before)} → {formatValue(change.after)}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </td>
    </tr>
  );
}
