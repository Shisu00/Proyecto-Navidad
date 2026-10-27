import { percentOf } from "../lib/dashboardStats.js";
import { labels } from "../lib/labels.js";

const COUNTER_KEYS = ["enrolled", "inReview", "pendingDelivery", "delivered"];

export default function SummaryOverview({ title, summary }) {
  // Validados = entregados + pendientes de entrega (SPECS §8.6)
  const totalGifts = summary.delivered + summary.pendingDelivery;
  const counters = { ...summary, inReview: summary.missing };

  return (
    <section className="overview" aria-labelledby="overview-title">
      <h2 id="overview-title">{title}</h2>
      <p className="overview-lead">
        <span className="overview-percent">{percentOf(summary.delivered, totalGifts)}%</span>
        <span>{labels.dashboard.deliveredOf(summary.delivered, totalGifts)}</span>
      </p>
      <progress
        className="meter"
        value={summary.delivered}
        max={Math.max(totalGifts, 1)}
        aria-label={labels.dashboard.progressLabel}
      />
      <dl className="counters">
        {COUNTER_KEYS.map((key) => (
          <div key={key} className="counter">
            <dt>{labels.dashboard.counters[key]}</dt>
            <dd>{counters[key]}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
