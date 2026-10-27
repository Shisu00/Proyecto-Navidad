import { percentOf } from "../lib/dashboardStats.js";
import { labels } from "../lib/labels.js";

const COUNTER_KEYS = ["enrolled", "validated", "missing", "delivered", "pendingDelivery", "discarded"];

export default function SummaryOverview({ title, summary }) {
  const percent = percentOf(summary.delivered, summary.validated);

  return (
    <section className="overview" aria-labelledby="overview-title">
      <h2 id="overview-title">{title}</h2>
      <p className="overview-lead">
        <span className="overview-percent">{percent}%</span>
        <span>{labels.dashboard.deliveredOf(summary.delivered, summary.validated)}</span>
      </p>
      <progress
        className="meter"
        value={summary.delivered}
        max={Math.max(summary.validated, 1)}
        aria-label={labels.dashboard.progressLabel}
      />
      <dl className="counters">
        {COUNTER_KEYS.map((key) => (
          <div key={key} className="counter">
            <dt>{labels.dashboard.counters[key]}</dt>
            <dd>{summary[key]}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
