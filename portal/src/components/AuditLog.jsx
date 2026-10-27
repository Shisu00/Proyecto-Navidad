import { useState } from "react";
import { useAuditLog } from "../hooks/useAuditLog.js";
import { useCatalogs } from "../hooks/useCatalogs.jsx";
import { AUDIT_ACTIONS } from "../lib/auditLog.js";
import { errorMessage, labels } from "../lib/labels.js";
import AuditRow from "./AuditRow.jsx";
import Notice from "./Notice.jsx";
import Pager from "./Pager.jsx";

const PAGE_SIZE = 30;

export default function AuditLog() {
  const { councilNames } = useCatalogs();
  const [action, setAction] = useState("");
  const [page, setPage] = useState(0);
  const { status, data, errorCode, reload } = useAuditLog({ action, page, pageSize: PAGE_SIZE });

  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function handleActionChange(event) {
    setAction(event.target.value);
    setPage(0);
  }

  return (
    <section className="stack-large" aria-labelledby="audit-title">
      <div className="stack">
        <h2 id="audit-title">{labels.audit.title}</h2>
        <p>{labels.audit.intro}</p>
      </div>

      <label className="field audit-filter">
        <span className="field-label">{labels.audit.filterAction}</span>
        <select value={action} onChange={handleActionChange}>
          <option value="">{labels.audit.filterAll}</option>
          {AUDIT_ACTIONS.map((option) => (
            <option key={option} value={option}>
              {labels.audit.actions[option]}
            </option>
          ))}
        </select>
      </label>

      {status === "error" ? (
        <div className="stack">
          <Notice tone="error">{errorMessage(errorCode)}</Notice>
          <button type="button" className="button button-primary" onClick={reload}>
            {labels.app.retry}
          </button>
        </div>
      ) : null}

      {data ? (
        <>
          <p className="list-count" aria-live="polite">
            {labels.audit.total(total)}
          </p>
          {data.rows.length === 0 ? (
            <p className="empty">{labels.audit.empty}</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">{labels.audit.columnDate}</th>
                  <th scope="col">{labels.audit.columnActor}</th>
                  <th scope="col">{labels.audit.columnAction}</th>
                  <th scope="col">{labels.audit.columnDetail}</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((entry) => (
                  <AuditRow key={entry.id} entry={entry} councilNames={councilNames} />
                ))}
              </tbody>
            </table>
          )}
          <Pager page={page} pages={pages} label={labels.audit.title} onPage={setPage} />
        </>
      ) : status !== "error" ? (
        <p className="empty">{labels.app.loading}</p>
      ) : null}
    </section>
  );
}
