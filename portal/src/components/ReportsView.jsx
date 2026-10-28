import { useState } from "react";
import { usePermissions } from "../hooks/useAccount.jsx";
import { useCatalogs } from "../hooks/useCatalogs.jsx";
import { downloadCsv } from "../lib/csv.js";
import { enumLabels, labels } from "../lib/labels.js";
import { buildDeliveriesCsv, buildInscriptionsCsv, reportFilename } from "../lib/reportExport.js";
import * as exportsService from "../services/exportsService.js";
import CsvExportButton from "./CsvExportButton.jsx";
import Notice from "./Notice.jsx";

const STATUS_OPTIONS = ["REGISTERED", "IN_REVIEW", "DELIVERED", "DISCARDED"];

function CouncilSelect({ value, onChange, councils }) {
  return (
    <label className="field">
      <span className="field-label">{labels.reports.filterCouncil}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{labels.reports.filterCouncilAll}</option>
        {councils.map((council) => (
          <option key={council.id} value={council.id}>
            {council.name}
          </option>
        ))}
      </select>
    </label>
  );
}

// Cada informe respeta la RLS: una persona solo recibe lo que puede ver en el portal
export default function ReportsView() {
  const { can } = usePermissions();
  const { selectedCampaign, councils } = useCatalogs();
  const [displayStatus, setDisplayStatus] = useState("");
  const [inscriptionCouncil, setInscriptionCouncil] = useState("");
  const [deliveryCouncil, setDeliveryCouncil] = useState("");
  const [onlyActive, setOnlyActive] = useState(false);

  if (!can("data.export")) return null;

  const campaign = selectedCampaign;

  async function exportInscriptions(onProgress) {
    const filters = { displayStatus, councilId: inscriptionCouncil };
    const rows = await exportsService.exportInscriptions(
      { campaignId: campaign.id, ...filters },
      { onProgress },
    );
    await exportsService.registerDataExport("INSCRIPTIONS", { campaign_id: campaign.id, ...filters }, rows.length);
    downloadCsv(reportFilename("inscripciones", campaign.name), buildInscriptionsCsv(rows));
    return rows.length;
  }

  async function exportDeliveries(onProgress) {
    const filters = { councilId: deliveryCouncil, onlyActive };
    const rows = await exportsService.exportDeliveries(
      { campaignId: campaign.id, ...filters },
      { onProgress },
    );
    await exportsService.registerDataExport("DELIVERIES", { campaign_id: campaign.id, ...filters }, rows.length);
    downloadCsv(reportFilename("entregas", campaign.name), buildDeliveriesCsv(rows));
    return rows.length;
  }

  return (
    <section className="stack-large" aria-labelledby="reports-title">
      <div className="stack">
        <h2 id="reports-title">{labels.reports.title}</h2>
        <p className="cell-sub">{labels.reports.intro}</p>
        {campaign ? (
          <p className="cell-sub">{labels.reports.campaignLabel(campaign.name)}</p>
        ) : (
          <Notice>{labels.reports.noCampaign}</Notice>
        )}
      </div>

      {campaign ? (
        <>
          <div className="panel stack">
            <h3>{labels.reports.inscriptionsTitle}</h3>
            <p className="cell-sub">{labels.reports.inscriptionsDescription}</p>
            <div className="audit-filters">
              <label className="field">
                <span className="field-label">{labels.reports.filterStatus}</span>
                <select value={displayStatus} onChange={(event) => setDisplayStatus(event.target.value)}>
                  <option value="">{labels.reports.filterStatusAll}</option>
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {enumLabels.displayStatus[status]}
                    </option>
                  ))}
                </select>
              </label>
              <CouncilSelect
                value={inscriptionCouncil}
                onChange={setInscriptionCouncil}
                councils={councils}
              />
            </div>
            <CsvExportButton
              idleLabel={labels.reports.exportButton}
              pendingLabel={labels.reports.exporting}
              doneLabel={labels.reports.done}
              run={exportInscriptions}
            />
          </div>

          <div className="panel stack">
            <h3>{labels.reports.deliveriesTitle}</h3>
            <p className="cell-sub">{labels.reports.deliveriesDescription}</p>
            <div className="audit-filters">
              <CouncilSelect value={deliveryCouncil} onChange={setDeliveryCouncil} councils={councils} />
              <label className="field-check">
                <input
                  type="checkbox"
                  checked={onlyActive}
                  onChange={(event) => setOnlyActive(event.target.checked)}
                />
                <span>{labels.reports.onlyActive}</span>
              </label>
            </div>
            <CsvExportButton
              idleLabel={labels.reports.exportButton}
              pendingLabel={labels.reports.exporting}
              doneLabel={labels.reports.done}
              run={exportDeliveries}
            />
          </div>
        </>
      ) : null}
    </section>
  );
}
