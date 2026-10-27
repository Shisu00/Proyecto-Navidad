import { auditReasonText, shortId } from "../lib/auditLog.js";
import { actorText, changeLine, entryChanges, summaryText } from "../lib/auditText.js";
import { formatDateTime } from "../lib/format.js";
import { labels } from "../lib/labels.js";

export default function AuditRow({ entry, councilNames }) {
  const summary = summaryText(entry, councilNames);
  const reason = auditReasonText(entry);
  const changes = entryChanges(entry);
  const entity = labels.audit.entities[entry.entity_type] ?? entry.entity_type;

  return (
    <tr>
      <td className="cell-audit" data-label={labels.audit.columnDate}>
        {formatDateTime(entry.occurred_at)}
      </td>
      <td className="cell-audit" data-label={labels.audit.columnAction}>
        <p className="cell-title">{labels.audit.actions[entry.action] ?? entry.action}</p>
        <p className="cell-sub">
          {labels.audit.by(actorText(entry))}
          {entry.entity_id ? ` · ${entity} ${shortId(entry.entity_id)}` : ""}
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
                <li key={change.field}>{changeLine(change)}</li>
              ))}
            </ul>
          </details>
        ) : null}
        {!summary && !reason && changes.length === 0 ? (
          <p className="cell-sub">{labels.audit.emptyValue}</p>
        ) : null}
      </td>
    </tr>
  );
}
