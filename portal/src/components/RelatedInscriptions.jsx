import { useRelatedInscriptions } from "../hooks/useInscriptionDetail.js";
import { formatDateTime } from "../lib/format.js";
import { errorMessage, labels } from "../lib/labels.js";
import Notice from "./Notice.jsx";
import StatusChip from "./StatusChip.jsx";

export default function RelatedInscriptions({ row, onOpen }) {
  const { status, data, errorCode } = useRelatedInscriptions(row);

  if (status === "error") return <Notice tone="error">{errorMessage(errorCode)}</Notice>;
  if (!data || data.length === 0) return null;

  return (
    <section className="stack" aria-labelledby="detail-related">
      <h3 id="detail-related">{labels.inscription.relatedTitle}</h3>
      <ul className="related-list">
        {data.map((item) => (
          <li key={item.id} className="related-item">
            <div className="related-info">
              <p className="cell-title">
                {item.duplicate_justification
                  ? labels.inscription.relatedDuplicate
                  : labels.inscription.relatedOriginal}
              </p>
              <p className="cell-sub">
                {item.council_name} · {item.guardian_full_name} · {formatDateTime(item.created_at)}
              </p>
            </div>
            <StatusChip displayStatus={item.display_status} />
            <button type="button" className="button button-small" onClick={() => onOpen(item)}>
              {labels.inscription.relatedOpen}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
