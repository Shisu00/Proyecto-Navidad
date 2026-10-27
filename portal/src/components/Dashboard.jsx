import { useMemo } from "react";
import { usePermissions } from "../hooks/useAccount.jsx";
import { useCatalogs } from "../hooks/useCatalogs.jsx";
import { useDashboardData } from "../hooks/useDashboardData.js";
import { useRealtimeDeliveries } from "../hooks/useRealtimeDeliveries.js";
import { buildPlanningMatrix, groupProgressByTerritory } from "../lib/dashboardStats.js";
import { errorMessage, labels } from "../lib/labels.js";
import DeliveryProgressTable from "./DeliveryProgressTable.jsx";
import Notice from "./Notice.jsx";
import PlanningMatrix from "./PlanningMatrix.jsx";
import SummaryOverview from "./SummaryOverview.jsx";

export default function Dashboard() {
  const { selectedCampaign, territoryNames, councilNames } = useCatalogs();
  const { can, profile } = usePermissions();
  const canReadPlanning = can("planning.read");
  const campaignId = selectedCampaign?.id ?? null;

  const { status, data, errorCode, reload } = useDashboardData(campaignId, canReadPlanning);
  useRealtimeDeliveries(campaignId, reload);

  const groups = useMemo(
    () => groupProgressByTerritory(data?.progress ?? [], { territoryNames, councilNames }),
    [data, territoryNames, councilNames],
  );
  const matrix = useMemo(
    () => buildPlanningMatrix(data?.planning ?? [], territoryNames),
    [data, territoryNames],
  );

  if (!selectedCampaign) return <Notice>{labels.dashboard.empty}</Notice>;

  if (!data) {
    if (status === "error") {
      return (
        <div className="stack">
          <Notice tone="error">{errorMessage(errorCode)}</Notice>
          <button type="button" className="button button-primary" onClick={reload}>
            {labels.app.retry}
          </button>
        </div>
      );
    }
    return <p className="empty">{labels.app.loading}</p>;
  }

  const title = canReadPlanning
    ? labels.dashboard.title
    : `${labels.dashboard.ownCouncilTitle}${
        profile?.council_id ? `: ${councilNames.get(profile.council_id) ?? ""}` : ""
      }`;

  return (
    <div className="stack-large">
      <SummaryOverview title={title} summary={data.summary} />
      <p className="live-note">{labels.dashboard.live}</p>

      {status === "error" ? <Notice tone="error">{errorMessage(errorCode)}</Notice> : null}

      {canReadPlanning ? (
        <>
          <section aria-labelledby="territory-title" className="section">
            <h2 id="territory-title">{labels.dashboard.territoryTitle}</h2>
            <DeliveryProgressTable groups={groups} />
          </section>

          <section aria-labelledby="planning-title" className="section">
            <h2 id="planning-title">{labels.dashboard.planningTitle}</h2>
            <p className="section-hint">{labels.dashboard.planningHint}</p>
            <PlanningMatrix matrix={matrix} />
          </section>
        </>
      ) : null}
    </div>
  );
}
