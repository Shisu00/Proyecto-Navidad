import { usePermissions } from "../hooks/useAccount.jsx";
import { useCatalogs } from "../hooks/useCatalogs.jsx";
import { buildAuditCsv, auditExportFilename } from "../lib/auditExport.js";
import { downloadCsv } from "../lib/csv.js";
import { labels } from "../lib/labels.js";
import * as auditService from "../services/auditService.js";
import CsvExportButton from "./CsvExportButton.jsx";

// Exporta todo el resultado filtrado (no solo la página visible).
export default function AuditExport({ filters, total }) {
  const { can } = usePermissions();
  const { councilNames } = useCatalogs();

  if (!can("audit.export")) return null;

  async function run(onProgress) {
    const rows = await auditService.exportAuditLog(filters, { total, onProgress });
    await auditService.registerAuditExport(filters, rows.length);

    const categoryLabel = filters.category
      ? labels.audit.categories[filters.category]
      : labels.audit.filterAll;
    downloadCsv(auditExportFilename(categoryLabel), buildAuditCsv(rows, { councilNames }));
    return rows.length;
  }

  return (
    <CsvExportButton
      idleLabel={labels.audit.exportButton(total)}
      pendingLabel={(done) => labels.audit.exporting(done, total)}
      doneLabel={labels.audit.exportDone}
      hint={labels.audit.exportHint}
      disabled={total === 0}
      run={run}
    />
  );
}
