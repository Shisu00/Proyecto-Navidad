import { formatDateTime } from "../lib/format.js";
import { formatIdNumber } from "../lib/identification.js";
import { enumLabels, labels } from "../lib/labels.js";
import IconButton from "./IconButton.jsx";
import StatusChip from "./StatusChip.jsx";

function childDetail(row) {
  const sexLabel = enumLabels.sex[row.sex];
  if (row.age_range === null)
    return labels.inscription.childOutOfRange(sexLabel, row.age_at_cutoff);
  return labels.inscription.childDetail(sexLabel, enumLabels.ageRange[row.age_range]);
}

export default function InscriptionRow({ row, showCouncil, onDetail, onCorrect, onReview }) {
  const isInReview = row.display_status === "IN_REVIEW";

  return (
    <tr>
      <td className="cell-child">
        <p className="cell-title">{formatIdNumber(row.beneficiary_id_number)}</p>
        <p className="cell-sub">{childDetail(row)}</p>
      </td>

      <td className="cell-guardian">
        <p className="cell-title">{row.guardian_full_name}</p>
        <p className="cell-sub">{formatIdNumber(row.guardian_id_number)}</p>
      </td>

      {showCouncil ? (
        <td className="cell-council">
          <p className="cell-title">{row.council_name}</p>
          <p className="cell-sub">{row.territory_name}</p>
        </td>
      ) : null}

      <td className="cell-status">
        <StatusChip displayStatus={row.display_status} />
        {row.delivered_at ? (
          <p className="cell-sub">
            {labels.inscription.deliveredAt(formatDateTime(row.delivered_at))}
          </p>
        ) : null}
        {isInReview && row.open_cases_count > 0 ? (
          <p className="cell-sub">{labels.inscription.openCases(row.open_cases_count)}</p>
        ) : null}
        {row.duplicate_justification ? (
          <details className="cell-note">
            <summary>{labels.inscription.hasObservation}</summary>
            <p>{row.duplicate_justification}</p>
          </details>
        ) : null}
      </td>

      <td className="cell-actions">
        <IconButton
          icon="eye"
          label={labels.inscription.viewDetail}
          onClick={() => onDetail(row)}
        />
        {onCorrect ? (
          <IconButton
            icon="pencil"
            label={labels.inscription.correct}
            onClick={() => onCorrect(row)}
          />
        ) : null}
        {onReview ? (
          <IconButton
            icon="review"
            label={labels.inscription.review}
            onClick={() => onReview(row)}
          />
        ) : null}
      </td>
    </tr>
  );
}
