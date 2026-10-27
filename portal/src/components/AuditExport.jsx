import { useState } from "react";
import { usePermissions } from "../hooks/useAccount.jsx";
import { useCatalogs } from "../hooks/useCatalogs.jsx";
import { buildAuditCsv, auditExportFilename } from "../lib/auditExport.js";
import { downloadCsv } from "../lib/csv.js";
import { toBusinessError } from "../lib/errors.js";
import { errorMessage, labels } from "../lib/labels.js";
import * as auditService from "../services/auditService.js";
import Notice from "./Notice.jsx";

// Exporta todo el resultado filtrado (no solo la página visible).
// Falla cerrado: si no se puede dejar constancia de la exportación, no se descarga.
export default function AuditExport({ filters, total }) {
  const { can } = usePermissions();
  const { councilNames } = useCatalogs();
  const [state, setState] = useState({ status: "idle", done: 0, count: 0, errorCode: null });

  if (!can("audit.export")) return null;

  const isPending = state.status === "pending";

  async function start() {
    setState({ status: "pending", done: 0, count: 0, errorCode: null });
    try {
      const rows = await auditService.exportAuditLog(filters, {
        total,
        onProgress: (done) => setState((previous) => ({ ...previous, done })),
      });
      await auditService.registerAuditExport(filters, rows.length);

      const categoryLabel = filters.category
        ? labels.audit.categories[filters.category]
        : labels.audit.filterAll;
      downloadCsv(auditExportFilename(categoryLabel), buildAuditCsv(rows, { councilNames }));
      setState({ status: "success", done: rows.length, count: rows.length, errorCode: null });
    } catch (caught) {
      setState({ status: "error", done: 0, count: 0, errorCode: toBusinessError(caught).code });
    }
  }

  return (
    <div className="stack">
      <div className="actions">
        <button
          type="button"
          className="button button-primary"
          disabled={isPending || total === 0}
          onClick={start}
        >
          {isPending ? labels.audit.exporting(state.done, total) : labels.audit.exportButton(total)}
        </button>
        <span className="cell-sub">{labels.audit.exportHint}</span>
      </div>
      {state.status === "success" ? (
        <Notice>{labels.audit.exportDone(state.count)}</Notice>
      ) : null}
      {state.status === "error" ? <Notice tone="error">{errorMessage(state.errorCode)}</Notice> : null}
    </div>
  );
}
