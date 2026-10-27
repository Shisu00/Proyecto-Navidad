import { formatDate, formatDateTime } from "../lib/format.js";
import { formatIdNumber } from "../lib/identification.js";
import { getReviewActions } from "../lib/inscriptionRules.js";
import { enumLabels, labels } from "../lib/labels.js";
import StatusChip from "./StatusChip.jsx";

export default function InscriptionRow({ row, canReview, onReview }) {
  const actions = canReview ? getReviewActions(row.status, Boolean(row.delivery_id)) : [];
  const rangeLabel = enumLabels.ageRange[row.age_range] ?? "";

  return (
    <li className="record">
      <div className="record-cell">
        <p className="record-title">{formatIdNumber(row.beneficiary_id_number)}</p>
        <p className="record-sub">
          <span>{enumLabels.idType[row.beneficiary_id_type]}</span>
          <span>{enumLabels.sex[row.sex]}</span>
          <span>{rangeLabel}</span>
        </p>
        <p className="record-sub">
          <span>{formatDate(row.birth_date)}</span>
        </p>
      </div>

      <div className="record-cell">
        <p className="record-title">{row.guardian_full_name}</p>
        <p className="record-sub">
          <span>{formatIdNumber(row.guardian_id_number)}</span>
        </p>
        <p className="record-sub">
          <span>{row.council_name}</span>
          <span>{row.territory_name}</span>
        </p>
      </div>

      <div className="record-cell">
        <StatusChip status={row.status} />
        <p className="record-sub">
          {row.has_observation ? <span className="flag">{labels.inscription.hasObservation}</span> : null}
          {row.open_cases_count > 0 ? (
            <span className="flag">{labels.inscription.openCases(row.open_cases_count)}</span>
          ) : null}
        </p>
        <p className="record-sub">
          <span>
            {row.delivered_at
              ? labels.inscription.deliveredAt(formatDateTime(row.delivered_at))
              : labels.inscription.notDelivered}
          </span>
        </p>
        <p className="record-sub">
          <span>
            {labels.inscription.registeredAt} {formatDateTime(row.created_at)}
          </span>
        </p>
      </div>

      {actions.length > 0 ? (
        <div className="record-actions">
          {actions.map((action) => (
            <button
              key={action}
              type="button"
              className="button button-small"
              onClick={() => onReview(row, action)}
            >
              {labels.inscription.actions[action]}
            </button>
          ))}
        </div>
      ) : null}

      {row.duplicate_justification ? (
        <details className="record-note">
          <summary>{labels.inscription.duplicateNote}</summary>
          <p>{row.duplicate_justification}</p>
        </details>
      ) : null}
    </li>
  );
}
