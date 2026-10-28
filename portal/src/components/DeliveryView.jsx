import { useEffect, useRef, useState } from "react";
import { usePermissions } from "../hooks/useAccount.jsx";
import { useCatalogs } from "../hooks/useCatalogs.jsx";
import { useConfirmDelivery, useVoidDelivery } from "../hooks/useDelivery.js";
import { useDeliverySummary } from "../hooks/useDeliverySummary.js";
import { useInscriptionList, useLoadGuardianPending } from "../hooks/useInscriptions.js";
import { isScannerSupported } from "../lib/cedulaScanner.js";
import { pendingGroups } from "../lib/deliveryGroups.js";
import { formatIdNumber, isValidIdNumber, normalizeIdNumber } from "../lib/identification.js";
import { errorMessage, labels } from "../lib/labels.js";
import { isIdentificationQuery, parseSearchText } from "../lib/searchQuery.js";
import ConfirmDeliveryDialog from "./ConfirmDeliveryDialog.jsx";
import DeliveryRow from "./DeliveryRow.jsx";
import CedulaPhotoButton from "./CedulaPhotoButton.jsx";
import DeliveryScanner from "./DeliveryScanner.jsx";
import Field from "./Field.jsx";
import Notice from "./Notice.jsx";
import ReasonDialog from "./ReasonDialog.jsx";

const SEARCH_DELAY_MS = 400;
const PAGE_SIZE = 20;
// La lectura en vivo no es confiable en todos los teléfonos: hoy se usa la foto de la cédula.
// El componente y el hook se conservan para reactivarla.
const SHOW_LIVE_SCANNER = false;

export default function DeliveryView() {
  const { selectedCampaign } = useCatalogs();
  const { can } = usePermissions();
  const searchRef = useRef(null);
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  const [scannedRun, setScannedRun] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [voidTarget, setVoidTarget] = useState(null);
  const [message, setMessage] = useState(null);

  const isDeliveryOpen = selectedCampaign?.status === "DELIVERY";
  const campaignId = selectedCampaign?.id ?? null;
  const query = parseSearchText(text);

  const { status, data, errorCode, reload } = useInscriptionList({
    campaignId: isDeliveryOpen && search ? campaignId : null,
    status: "VALIDATED",
    search,
    pendingDeliveryFirst: true,
    page: 0,
    pageSize: PAGE_SIZE,
  });
  const summary = useDeliverySummary(isDeliveryOpen ? campaignId : null);
  const groupLoader = useLoadGuardianPending();
  const confirmation = useConfirmDelivery();
  const voiding = useVoidDelivery();

  // Busca mientras se escribe, pero sin una consulta por tecla. Si el texto queda corto
  // o vacío, el resultado se borra de inmediato.
  useEffect(() => {
    if (!query) {
      setSearch("");
      return undefined;
    }
    const timer = setTimeout(() => setSearch(query), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [query]);

  function handleTextChange(event) {
    setText(event.target.value);
    setMessage(null);
    // Si el usuario edita el RUN, ya no es el que se leyó de la cédula
    setScannedRun(null);
  }

  // Al salir del campo, un RUN o IPE completo se muestra con su formato habitual
  function handleBlur() {
    if (!isIdentificationQuery(text)) return;
    const normalized = normalizeIdNumber(text);
    if (isValidIdNumber("RUT", normalized) || isValidIdNumber("IPE", normalized)) {
      setText(formatIdNumber(normalized));
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (query) setSearch(query);
  }

  function handleScanned(run) {
    setIsScanning(false);
    setScannedRun(run);
    setText(formatIdNumber(run));
    setMessage(null);
    setSearch(run);
  }

  function closeConfirm() {
    setConfirmTarget(null);
    confirmation.reset();
  }

  function closeVoid() {
    setVoidTarget(null);
    voiding.reset();
  }

  // Carga todos los regalos pendientes del adulto y abre una sola confirmación
  async function startBatch(group) {
    setMessage(null);
    const result = await groupLoader.run({
      campaignId,
      guardianIdNumber: group.guardianIdNumber,
    });
    if (result.status === "success" && result.data.length > 0) setConfirmTarget(result.data);
  }

  // Deja todo listo para la siguiente persona de la fila
  async function confirm(payload) {
    const adult = confirmTarget[0].guardian_full_name;
    const count = confirmTarget.length;
    const result = await confirmation.run(payload);
    if (result.status === "success") {
      closeConfirm();
      setText("");
      setSearch("");
      setScannedRun(null);
      setMessage(
        count > 1
          ? labels.delivery.successDeliveredMany(count, adult)
          : labels.delivery.successDeliveredTo(adult),
      );
      summary.reload();
      searchRef.current?.focus();
    }
  }

  async function voidDelivery(reason) {
    const result = await voiding.run({ deliveryId: voidTarget.delivery_id, reason });
    if (result.status === "success") {
      closeVoid();
      setMessage(labels.delivery.successVoided);
      reload();
      summary.reload();
    }
  }

  return (
    <section className="stack-large" aria-labelledby="delivery-title">
      <div className="stack">
        <h2 id="delivery-title">{labels.delivery.title}</h2>
        <p>{labels.delivery.intro}</p>
      </div>

      {!isDeliveryOpen ? <Notice tone="warning">{labels.delivery.notOpen}</Notice> : null}

      {summary.data ? (
        <p className="delivery-counter" aria-live="polite">
          {labels.delivery.counter(
            summary.data.delivered,
            summary.data.pendingDelivery,
            can("delivery.read_all"),
          )}
        </p>
      ) : null}

      <form className="search" onSubmit={handleSubmit} role="search">
        <Field label={labels.delivery.searchLabel} hint={labels.delivery.searchHint}>
          {(props) => (
            <input
              {...props}
              ref={searchRef}
              type="search"
              autoComplete="off"
              inputMode="search"
              disabled={!isDeliveryOpen}
              value={text}
              onChange={handleTextChange}
              onBlur={handleBlur}
            />
          )}
        </Field>
        <div className="search-actions">
          <CedulaPhotoButton
            className="button button-primary"
            onRun={handleScanned}
            onBeforeCapture={() => setIsScanning(false)}
            disabled={!isDeliveryOpen}
          />
          <button type="submit" className="button" disabled={!isDeliveryOpen}>
            {labels.delivery.search}
          </button>
          {SHOW_LIVE_SCANNER && isScannerSupported() ? (
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

      {SHOW_LIVE_SCANNER && isScanning ? (
        <DeliveryScanner onRun={handleScanned} onClose={() => setIsScanning(false)} />
      ) : null}
      {scannedRun ? (
        <p className="field-hint">{labels.delivery.scannedRun(formatIdNumber(scannedRun))}</p>
      ) : null}
      {message ? <Notice>{message}</Notice> : null}

      {status === "error" ? <Notice tone="error">{errorMessage(errorCode)}</Notice> : null}

      {!search ? <p className="empty">{labels.delivery.promptSearch}</p> : null}
      {search && data ? (
        data.rows.length === 0 ? (
          <p className="empty">
            {can("inscription.read_all") ? labels.delivery.noResultsAll : labels.delivery.noResults}
          </p>
        ) : (
          <>
            {pendingGroups(data.rows).map((group) => (
              <div key={group.guardianIdNumber} className="batch-bar">
                <p>
                  {labels.delivery.batchSummary(
                    group.guardianName,
                    formatIdNumber(group.guardianIdNumber),
                    group.count,
                  )}
                </p>
                <button
                  type="button"
                  className="button button-primary"
                  disabled={groupLoader.state.status === "pending"}
                  onClick={() => startBatch(group)}
                >
                  {labels.delivery.batchButton}
                </button>
              </div>
            ))}
            {groupLoader.state.status === "error" ? (
              <Notice tone="error">{errorMessage(groupLoader.state.error.code)}</Notice>
            ) : null}
            <ul className="records">
              {data.rows.map((row) => (
                <DeliveryRow
                  key={row.id}
                  row={row}
                  onDeliver={(target) => setConfirmTarget([target])}
                  onVoid={setVoidTarget}
                />
              ))}
            </ul>
          </>
        )
      ) : null}

      {confirmTarget ? (
        <ConfirmDeliveryDialog
          rows={confirmTarget}
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
