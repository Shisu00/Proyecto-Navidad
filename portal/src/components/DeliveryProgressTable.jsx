import { labels } from "../lib/labels.js";

function ProgressRow({ name, delivered, pendingDelivery, percent }) {
  return (
    <div className="progress-row">
      <span className="progress-name">{name}</span>
      <progress className="meter meter-small" value={percent} max={100} aria-label={`${name}: ${percent}%`} />
      <span className="progress-figures">
        <span title={labels.dashboard.columnDelivered}>{delivered}</span>
        <span title={labels.dashboard.columnPending}>{pendingDelivery}</span>
      </span>
    </div>
  );
}

export default function DeliveryProgressTable({ groups }) {
  if (groups.length === 0) {
    return <p className="empty">{labels.dashboard.territoryEmpty}</p>;
  }

  return (
    <div className="progress-list">
      <div className="progress-head" aria-hidden="true">
        <span />
        <span />
        <span className="progress-figures">
          <span>{labels.dashboard.columnDelivered}</span>
          <span>{labels.dashboard.columnPending}</span>
        </span>
      </div>
      {groups.map((group) => (
        <details key={group.key} className="progress-group">
          <summary>
            <ProgressRow {...group} />
          </summary>
          <p className="progress-count">{labels.dashboard.councilsOf(group.councils.length)}</p>
          <div className="progress-children">
            {group.councils.map((council) => (
              <ProgressRow key={council.key} {...council} />
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}
