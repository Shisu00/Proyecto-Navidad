import { useState } from "react";
import { usePermissions } from "../hooks/useAccount.jsx";
import { useCatalogs } from "../hooks/useCatalogs.jsx";
import { useInscriptionList, useResolveInscription } from "../hooks/useInscriptions.js";
import { canReviewInscriptions } from "../lib/campaignRules.js";
import { getReviewActions, isReasonRequired } from "../lib/inscriptionRules.js";
import { enumLabels, errorMessage, labels } from "../lib/labels.js";
import ChoiceGroup from "./ChoiceGroup.jsx";
import IdSearch from "./IdSearch.jsx";
import InscriptionDetailDialog from "./InscriptionDetailDialog.jsx";
import InscriptionRow from "./InscriptionRow.jsx";
import Notice from "./Notice.jsx";
import Pager from "./Pager.jsx";
import ReasonDialog from "./ReasonDialog.jsx";

const PAGE_SIZE = 25;
const STATUS_OPTIONS = ["REGISTERED", "DELIVERED", "DISCARDED", "IN_REVIEW"];

export default function InscriptionList() {
  const { selectedCampaign } = useCatalogs();
  const { can } = usePermissions();
  const [status, setStatus] = useState("");
  const [hasObservation, setHasObservation] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [reviewTarget, setReviewTarget] = useState(null);
  const [detailTarget, setDetailTarget] = useState(null);

  const { status: loadStatus, data, errorCode, reload } = useInscriptionList({
    campaignId: selectedCampaign?.id ?? null,
    displayStatus: status,
    hasObservation,
    search,
    page,
    pageSize: PAGE_SIZE,
  });
  const { state: resolveState, run: resolve, reset: resetResolve } = useResolveInscription();

  const canReview = can("inscription.review") && canReviewInscriptions(selectedCampaign?.status);
  const showCouncil = can("inscription.read_all");
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function handleStatusChange(event) {
    setStatus(event.target.value);
    setPage(0);
  }

  function handleObservationChange(event) {
    setHasObservation(event.target.checked);
    setPage(0);
  }

  function handleSearch(normalized) {
    setSearch(normalized);
    setPage(0);
  }

  function closeReview() {
    setReviewTarget(null);
    resetResolve();
  }

  function openReview(row) {
    const [firstAction] = getReviewActions(row.status, Boolean(row.delivery_id));
    setReviewTarget({ row, action: firstAction });
  }

  async function confirmReview(reason) {
    const result = await resolve({
      inscriptionId: reviewTarget.row.id,
      action: reviewTarget.action,
      reason,
    });
    if (result.status === "success") {
      closeReview();
      reload();
    }
  }

  return (
    <section className="stack-large" aria-labelledby="list-title">
      <h2 id="list-title">{labels.inscription.listTitle}</h2>

      <div className="filters">
        <IdSearch onSearch={handleSearch} hasActiveSearch={search !== ""} />
        <div className="filter-group">
          <label className="field">
            <span className="field-label">{labels.inscription.filterStatus}</span>
            <select value={status} onChange={handleStatusChange}>
              <option value="">{labels.inscription.filterAll}</option>
              {STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {enumLabels.displayStatus[option]}
                </option>
              ))}
            </select>
          </label>
          <label className="choice">
            <input type="checkbox" checked={hasObservation} onChange={handleObservationChange} />
            <span>{labels.inscription.filterObservation}</span>
          </label>
        </div>
      </div>

      {loadStatus === "error" ? (
        <div className="stack">
          <Notice tone="error">{errorMessage(errorCode)}</Notice>
          <button type="button" className="button button-primary" onClick={reload}>
            {labels.app.retry}
          </button>
        </div>
      ) : null}

      {data ? (
        <>
          <p className="list-count" aria-live="polite">
            {labels.inscription.total(total)}
          </p>
          {data.rows.length === 0 ? (
            <p className="empty">{labels.inscription.listEmpty}</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">{labels.inscription.columnChild}</th>
                  <th scope="col">{labels.inscription.columnGuardian}</th>
                  {showCouncil ? <th scope="col">{labels.inscription.columnCouncil}</th> : null}
                  <th scope="col">{labels.inscription.columnStatus}</th>
                  <th scope="col">{labels.inscription.columnActions}</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <InscriptionRow
                    key={row.id}
                    row={row}
                    showCouncil={showCouncil}
                    onDetail={setDetailTarget}
                    onReview={
                      canReview && getReviewActions(row.status, Boolean(row.delivery_id)).length > 0
                        ? openReview
                        : null
                    }
                  />
                ))}
              </tbody>
            </table>
          )}

          <Pager
            page={page}
            pages={pages}
            label={labels.inscription.listTitle}
            onPage={setPage}
          />
        </>
      ) : loadStatus !== "error" ? (
        <p className="empty">{labels.app.loading}</p>
      ) : null}

      {detailTarget ? (
        <InscriptionDetailDialog
          row={detailTarget}
          onClose={() => setDetailTarget(null)}
          onOpenRelated={setDetailTarget}
        />
      ) : null}

      {reviewTarget ? (
        <ReasonDialog
          title={labels.inscription.reviewHeading}
          description={labels.inscription.reviewDescription}
          reasonLabel={
            isReasonRequired(reviewTarget.row.status, reviewTarget.action)
              ? labels.inscription.reviewReason
              : labels.inscription.reviewReasonOptional
          }
          confirmLabel={labels.inscription.actions[reviewTarget.action]}
          isRequired={isReasonRequired(reviewTarget.row.status, reviewTarget.action)}
          isPending={resolveState.status === "pending"}
          errorCode={resolveState.status === "error" ? resolveState.error.code : null}
          onConfirm={confirmReview}
          onCancel={closeReview}
        >
          <ChoiceGroup
            legend={labels.inscription.reviewResult}
            name="reviewAction"
            options={getReviewActions(
              reviewTarget.row.status,
              Boolean(reviewTarget.row.delivery_id),
            ).map((action) => ({ value: action, label: labels.inscription.actions[action] }))}
            value={reviewTarget.action}
            onChange={(action) => setReviewTarget({ ...reviewTarget, action })}
          />
        </ReasonDialog>
      ) : null}
    </section>
  );
}
