import { useState } from "react";
import { useCatalogs } from "../hooks/useCatalogs.jsx";
import { useConfirmDelivery, useVoidDelivery } from "../hooks/useDelivery.js";
import { useInscriptionList } from "../hooks/useInscriptions.js";
import { isScannerSupported } from "../lib/cedulaScanner.js";
import { formatIdNumber, normalizeIdNumber } from "../lib/identification.js";
import { errorMessage, labels } from "../lib/labels.js";
import ConfirmDeliveryDialog from "./ConfirmDeliveryDialog.jsx";
import DeliveryRow from "./DeliveryRow.jsx";
import DeliveryScanner from "./DeliveryScanner.jsx";
import Field from "./Field.jsx";
import Notice from "./Notice.jsx";
import ReasonDialog from "./ReasonDialog.jsx";

const MIN_SEARCH_LENGTH = 3;
const PAGE_SIZE = 10;

export default function DeliveryView() {
  const { selectedCampaign } = useCatalogs();
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  const [scannedRun, setScannedRun] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [voidTarget, setVoidTarget] = useState(null);
  const [message, setMessage] = useState(null);

  const isDeliveryOpen = selectedCampaign?.status === "DELIVERY";
  const { status, data, errorCode, reload } = useInscriptionList({
    campaignId: isDeliveryOpen && search ? selectedCampaign.id : null,
    status: "VALIDATED",
    search,
    page: 0,
    pageSize: PAGE_SIZE,
  });
  const confirmation = useConfirmDelivery();
  const voiding = useVoidDelivery();

  function applySearch(normalized) {
    setMessage(null);
    setSearch(normalized);
  }

  function handleSubmit(event) {
    event.preventDefault();
    const normalized = normalizeIdNumber(text);
    if (normalized.length >= MIN_SEARCH_LENGTH) {
      setScannedRun(null);
      applySearch(normalized);
    }
  }

  function handleScanned(run) {
    setIsScanning(false);
    setScannedRun(run);
    setText(formatIdNumber(run));
    applySearch(run);
  }

  function closeConfirm() {
    setConfirmTarget(null);
    confirmation.reset();
  }

  function closeVoid() {
    setVoidTarget(null);
    voiding.reset();
  }

  async function confirm(payload) {
    const result = await confirmation.run(payload);
    if (result.status === "success") {
      closeConfirm();
      setMessage(labels.delivery.successDelivered);
      reload();
    }
  }

  async function voidDelivery(reason) {
    const result = await voiding.run({ deliveryId: voidTarget.delivery_id, reason });
    if (result.status === "success") {
      closeVoid();
      setMessage(labels.delivery.successVoided);
      reload();
    }
  }

  return (
    <section className="stack-large" aria-labelledby="delivery-title">
      <div className="stack">
        <h2 id="delivery-title">{labels.delivery.title}</h2>
        <p>{labels.delivery.intro}</p>
      </div>

      {!isDeliveryOpen ? <Notice tone="warning">{labels.delivery.notOpen}</Notice> : null}

      <form className="search" onSubmit={handleSubmit} role="search">
        <Field label={labels.delivery.searchLabel} hint={labels.delivery.searchHint}>
          {(props) => (
            <input
              {...props}
              type="search"
              autoComplete="off"
              disabled={!isDeliveryOpen}
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
          )}
        </Field>
        <div className="search-actions">
          <button type="submit" className="button button-primary" disabled={!isDeliveryOpen}>
            {labels.delivery.search}
          </button>
          {isScannerSupported() ? (
            <button
              type="button"
              className="button"
              disabled={!isDeliveryOpen}
              onClick={() => setIsScanning(true)}
            >
              {labels.delivery.scan}
            </button>
          ) : null}
        </div>
      </form>

      {!isScannerSupported() ? <p className="field-hint">{labels.delivery.scanUnsupported}</p> : null}
      {isScanning ? (
        <DeliveryScanner onRun={handleScanned} onClose={() => setIsScanning(false)} />
      ) : null}
      {scannedRun ? <p className="field-hint">{labels.delivery.scannedRun(formatIdNumber(scannedRun))}</p> : null}
      {message ? <Notice>{message}</Notice> : null}

      {status === "error" ? (
        <Notice tone="error">{errorMessage(errorCode)}</Notice>
      ) : null}

      {!search ? <p className="empty">{labels.delivery.promptSearch}</p> : null}
      {search && data ? (
        data.rows.length === 0 ? (
          <p className="empty">{labels.delivery.noResults}</p>
        ) : (
          <ul className="records">
            {data.rows.map((row) => (
              <DeliveryRow key={row.id} row={row} onDeliver={setConfirmTarget} onVoid={setVoidTarget} />
            ))}
          </ul>
        )
      ) : null}

      {confirmTarget ? (
        <ConfirmDeliveryDialog
          row={confirmTarget}
          scannedRun={scannedRun}
          isPending={confirmation.state.status === "pending"}
          errorCode={confirmation.state.status === "error" ? confirmation.state.error.code : null}
          onConfirm={confirm}
          onCancel={closeConfirm}
        />
      ) : null}

      {voidTarget ? (
        <ReasonDialog
          title={labels.delivery.voidTitle}
          description={labels.delivery.voidDescription}
          reasonLabel={labels.delivery.voidReason}
          confirmLabel={labels.delivery.voidConfirm}
          isRequired
          isPending={voiding.state.status === "pending"}
          errorCode={voiding.state.status === "error" ? voiding.state.error.code : null}
          onConfirm={voidDelivery}
          onCancel={closeVoid}
        />
      ) : null}
    </section>
  );
}
