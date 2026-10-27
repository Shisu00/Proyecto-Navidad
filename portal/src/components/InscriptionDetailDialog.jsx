import { useEffect, useRef } from "react";
import { formatDate, formatDateTime } from "../lib/format.js";
import { formatIdNumber } from "../lib/identification.js";
import { enumLabels, labels } from "../lib/labels.js";
import StatusChip from "./StatusChip.jsx";

function Detail({ term, children }) {
  return (
    <div className="detail-item">
      <dt>{term}</dt>
      <dd>{children || labels.inscription.detailNotProvided}</dd>
    </div>
  );
}

function ageText(row) {
  if (row.age_range === null) return labels.inscription.detailOutOfRange(row.age_at_cutoff);
  return `${row.age_at_cutoff} · ${enumLabels.ageRange[row.age_range]}`;
}

export default function InscriptionDetailDialog({ row, onClose }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="dialog dialog-wide"
      aria-labelledby="detail-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="stack-large">
        <div className="stack">
          <h2 id="detail-title">{labels.inscription.detailTitle}</h2>
          <StatusChip displayStatus={row.display_status} />
        </div>

        <section className="stack" aria-labelledby="detail-child">
          <h3 id="detail-child">{labels.inscription.childSection}</h3>
          <dl className="detail-list">
            <Detail term={enumLabels.idType[row.beneficiary_id_type]}>
              {formatIdNumber(row.beneficiary_id_number)}
            </Detail>
            <Detail term={labels.inscription.sex}>{enumLabels.sex[row.sex]}</Detail>
            <Detail term={labels.inscription.birthDate}>{formatDate(row.birth_date)}</Detail>
            <Detail term={labels.inscription.detailAge}>{ageText(row)}</Detail>
          </dl>
        </section>

        <section className="stack" aria-labelledby="detail-guardian">
          <h3 id="detail-guardian">{labels.inscription.guardianSection}</h3>
          <dl className="detail-list">
            <Detail term={labels.inscription.guardianName}>{row.guardian_full_name}</Detail>
            <Detail term={labels.inscription.guardianIdNumber}>
              {formatIdNumber(row.guardian_id_number)}
            </Detail>
            <Detail term={labels.inscription.detailEmail}>{row.guardian_email}</Detail>
            <Detail term={labels.inscription.detailPhone}>{row.guardian_phone}</Detail>
          </dl>
        </section>

        <section className="stack" aria-labelledby="detail-registration">
          <h3 id="detail-registration">{labels.inscription.detailRegistration}</h3>
          <dl className="detail-list">
            <Detail term={labels.inscription.columnCouncil}>{row.council_name}</Detail>
            <Detail term={labels.inscription.detailTerritory}>{row.territory_name}</Detail>
            <Detail term={labels.inscription.detailRegisteredAt}>
              {formatDateTime(row.created_at)}
            </Detail>
            <Detail term={labels.inscription.detailDelivery}>
              {row.delivered_at
                ? formatDateTime(row.delivered_at)
                : labels.inscription.detailNotDelivered}
            </Detail>
            {row.open_cases_count > 0 ? (
              <Detail term={labels.inscription.detailOpenCases}>{row.open_cases_count}</Detail>
            ) : null}
          </dl>
        </section>

        {row.duplicate_justification ? (
          <section className="stack" aria-labelledby="detail-observation">
            <h3 id="detail-observation">{labels.inscription.hasObservation}</h3>
            <p className="detail-observation">{row.duplicate_justification}</p>
          </section>
        ) : null}

        <div className="dialog-actions">
          <button type="button" className="button button-primary" onClick={onClose}>
            {labels.dialog.close}
          </button>
        </div>
      </div>
    </dialog>
  );
}
