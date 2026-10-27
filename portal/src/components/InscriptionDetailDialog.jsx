import { useEffect, useRef } from "react";
import { formatDate, formatDateTime } from "../lib/format.js";
import { formatIdNumber } from "../lib/identification.js";
import { enumLabels, labels } from "../lib/labels.js";
import DeliveryHistory from "./DeliveryHistory.jsx";
import DetailItem from "./DetailItem.jsx";
import RelatedInscriptions from "./RelatedInscriptions.jsx";
import StatusChip from "./StatusChip.jsx";

function ageText(row) {
  if (row.age_range === null) return labels.inscription.detailOutOfRange(row.age_at_cutoff);
  return `${row.age_at_cutoff} · ${enumLabels.ageRange[row.age_range]}`;
}

export default function InscriptionDetailDialog({ row, onClose, onOpenRelated }) {
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
            <DetailItem term={enumLabels.idType[row.beneficiary_id_type]}>
              {formatIdNumber(row.beneficiary_id_number)}
            </DetailItem>
            <DetailItem term={labels.inscription.sex}>{enumLabels.sex[row.sex]}</DetailItem>
            <DetailItem term={labels.inscription.birthDate}>{formatDate(row.birth_date)}</DetailItem>
            <DetailItem term={labels.inscription.detailAge}>{ageText(row)}</DetailItem>
          </dl>
        </section>

        <section className="stack" aria-labelledby="detail-guardian">
          <h3 id="detail-guardian">{labels.inscription.guardianSection}</h3>
          <dl className="detail-list">
            <DetailItem term={labels.inscription.guardianName}>{row.guardian_full_name}</DetailItem>
            <DetailItem term={labels.inscription.guardianIdNumber}>
              {formatIdNumber(row.guardian_id_number)}
            </DetailItem>
            <DetailItem term={labels.inscription.detailEmail}>{row.guardian_email}</DetailItem>
            <DetailItem term={labels.inscription.detailPhone}>{row.guardian_phone}</DetailItem>
          </dl>
        </section>

        <section className="stack" aria-labelledby="detail-registration">
          <h3 id="detail-registration">{labels.inscription.detailRegistration}</h3>
          <dl className="detail-list">
            <DetailItem term={labels.inscription.columnCouncil}>{row.council_name}</DetailItem>
            <DetailItem term={labels.inscription.detailTerritory}>{row.territory_name}</DetailItem>
            <DetailItem term={labels.inscription.detailRegisteredAt}>
              {formatDateTime(row.created_at)}
            </DetailItem>
            {row.open_cases_count > 0 ? (
              <DetailItem term={labels.inscription.detailOpenCases}>
                {row.open_cases_count}
              </DetailItem>
            ) : null}
          </dl>
        </section>

        {row.duplicate_justification ? (
          <section className="stack" aria-labelledby="detail-observation">
            <h3 id="detail-observation">{labels.inscription.hasObservation}</h3>
            <p className="detail-observation">{row.duplicate_justification}</p>
          </section>
        ) : null}

        <RelatedInscriptions row={row} onOpen={onOpenRelated} />
        <DeliveryHistory inscriptionId={row.id} />

        <div className="dialog-actions">
          <button type="button" className="button button-primary" onClick={onClose}>
            {labels.dialog.close}
          </button>
        </div>
      </div>
    </dialog>
  );
}
