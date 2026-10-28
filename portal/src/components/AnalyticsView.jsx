import { usePermissions } from "../hooks/useAccount.jsx";
import { useAnalytics } from "../hooks/useAnalytics.js";
import { useCatalogs } from "../hooks/useCatalogs.jsx";
import { errorMessage, labels } from "../lib/labels.js";
import Notice from "./Notice.jsx";
import ProjectionPanel from "./ProjectionPanel.jsx";
import TimeSeriesChart from "./TimeSeriesChart.jsx";

export default function AnalyticsView() {
  const { can } = usePermissions();
  const { selectedCampaign } = useCatalogs();
  const { status, data, errorCode, reload } = useAnalytics(selectedCampaign?.id ?? null);
  const a = labels.analytics;

  if (!can("planning.read")) return null;
  if (!selectedCampaign) return <Notice>{a.noCampaign}</Notice>;

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

  return (
    <div className="stack-large">
      <div className="stack">
        <h2>{a.title}</h2>
        <p className="cell-sub">{a.intro}</p>
      </div>

      <section className="panel stack" aria-labelledby="weekly-title">
        <h3 id="weekly-title">{a.weeklyTitle}</h3>
        <TimeSeriesChart
          title={a.weeklyTable}
          series={data.weekly}
          valueKey="registered"
          valueLabel={a.registered}
          emptyText={a.weeklyEmpty}
          columns={[
            { key: "date", label: a.weekOf },
            { key: "registered", label: a.registered },
            { key: "cumulative", label: a.cumulative },
          ]}
        />
      </section>

      <section className="panel stack" aria-labelledby="daily-title">
        <h3 id="daily-title">{a.dailyTitle}</h3>
        <TimeSeriesChart
          title={a.dailyTable}
          series={data.daily}
          valueKey="delivered"
          valueLabel={a.delivered}
          emptyText={a.dailyEmpty}
          columns={[
            { key: "date", label: a.day },
            { key: "delivered", label: a.delivered },
            { key: "voided", label: a.voided },
            { key: "cumulative", label: a.cumulative },
          ]}
        />
      </section>

      <section className="panel stack" aria-labelledby="projection-title">
        <h3 id="projection-title">{a.projection.title}</h3>
        <ProjectionPanel projection={data.projection} />
      </section>
    </div>
  );
}
