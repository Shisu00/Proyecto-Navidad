import { useDeliveryHistory } from "../hooks/useInscriptionDetail.js";
import { formatDateTime } from "../lib/format.js";
import { formatIdNumber } from "../lib/identification.js";
import { enumLabels, errorMessage, labels } from "../lib/labels.js";
import DetailItem from "./DetailItem.jsx";
import Notice from "./Notice.jsx";

function DeliveryEntry({ delivery }) {
  const isVoided = Boolean(delivery.voided_at);
  const unavailable = labels.inscription.detailUnavailable;

  return (
    <li className="delivery-entry">
      <p className="cell-title">
        {isVoided ? labels.inscription.deliveryVoided : labels.inscription.deliveryActive}
      </p>
      <dl className="detail-list">
        <DetailItem term={labels.inscription.deliveryDate}>
          {formatDateTime(delivery.delivered_at)}
        </DetailItem>
        <DetailItem term={labels.inscription.deliveryBy} fallback={unavailable}>
          {delivery.deliveredByName}
        </DetailItem>
        <DetailItem term={labels.inscription.deliveryType}>
          {enumLabels.withdrawalType[delivery.withdrawal_type]}
        </DetailItem>
        <DetailItem term={labels.inscription.deliveryWithdrawer}>
          {delivery.withdrawer_id_number ? formatIdNumber(delivery.withdrawer_id_number) : null}
        </DetailItem>
        <DetailItem term={labels.inscription.deliveryScanned}>
          {delivery.scanned_from_id_card ? labels.app.yes : labels.app.no}
        </DetailItem>
        {delivery.observation ? (
          <DetailItem term={labels.inscription.deliveryObservation}>
            {delivery.observation}
          </DetailItem>
        ) : null}
        {isVoided ? (
          <>
            <DetailItem term={labels.inscription.deliveryVoidedAt}>
              {formatDateTime(delivery.voided_at)}
            </DetailItem>
            <DetailItem term={labels.inscription.deliveryVoidedBy} fallback={unavailable}>
              {delivery.voidedByName}
            </DetailItem>
            <DetailItem term={labels.inscription.deliveryVoidReason}>
              {delivery.void_reason}
            </DetailItem>
          </>
        ) : null}
      </dl>
    </li>
  );
}

export default function DeliveryHistory({ inscriptionId }) {
  const { status, data, errorCode } = useDeliveryHistory(inscriptionId);

  return (
    <section className="stack" aria-labelledby="detail-delivery">
      <h3 id="detail-delivery">{labels.inscription.detailDelivery}</h3>
      {status === "error" ? <Notice tone="error">{errorMessage(errorCode)}</Notice> : null}
      {!data && status !== "error" ? <p className="cell-sub">{labels.app.loading}</p> : null}
      {data && data.length === 0 ? (
        <p>{labels.inscription.detailNotDelivered}</p>
      ) : null}
      {data && data.length > 0 ? (
        <ul className="delivery-list">
          {data.map((delivery) => (
            <DeliveryEntry key={delivery.id} delivery={delivery} />
          ))}
        </ul>
      ) : null}
    </section>
  );
}
