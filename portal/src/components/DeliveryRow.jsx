import { formatDateTime } from "../lib/format.js";
import { formatIdNumber } from "../lib/identification.js";
import { enumLabels, labels } from "../lib/labels.js";

export default function DeliveryRow({ row, onDeliver, onVoid }) {
  const isDelivered = Boolean(row.delivery_id);

  return (
    <li className="record">
      <div className="record-cell">
        <p className="record-title">{formatIdNumber(row.beneficiary_id_number)}</p>
        <p className="record-sub">
          <span>{enumLabels.idType[row.beneficiary_id_type]}</span>
          <span>{enumLabels.sex[row.sex]}</span>
          <span>{enumLabels.ageRange[row.age_range]}</span>
        </p>
      </div>
      <div className="record-cell">
        <p className="record-title">{row.guardian_full_name}</p>
        <p className="record-sub">
          <span>{formatIdNumber(row.guardian_id_number)}</span>
        </p>
      </div>
      <div className="record-cell">
        <p className={isDelivered ? "flag-ok" : "flag"}>
          {isDelivered
            ? labels.delivery.deliveredAt(formatDateTime(row.delivered_at))
            : labels.delivery.pendingDelivery}
        </p>
        {row.has_observation ? (
          <p className="record-sub">
            <span className="flag">{labels.inscription.hasObservation}</span>
          </p>
        ) : null}
      </div>
      <div className="record-actions">
        {isDelivered ? (
          <button type="button" className="button button-small" onClick={() => onVoid(row)}>
            {labels.delivery.void}
          </button>
        ) : (
          <button type="button" className="button button-primary button-small" onClick={() => onDeliver(row)}>
            {labels.delivery.deliver}
          </button>
        )}
      </div>
    </li>
  );
}
