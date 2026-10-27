import { useState } from "react";
import { usePermissions } from "../hooks/useAccount.jsx";
import { useCatalogs } from "../hooks/useCatalogs.jsx";
import { useInscriptionList, useResolveInscription } from "../hooks/useInscriptions.js";
import { canReviewInscriptions } from "../lib/campaignRules.js";
import { isReasonRequired } from "../lib/inscriptionRules.js";
import { enumLabels, errorMessage, labels } from "../lib/labels.js";
import IdSearch from "./IdSearch.jsx";
import InscriptionRow from "./InscriptionRow.jsx";
import Notice from "./Notice.jsx";
import ReasonDialog from "./ReasonDialog.jsx";

const PAGE_SIZE = 25;
const STATUS_OPTIONS = ["PENDING", "OBSERVED", "VALIDATED", "DISCARDED"];

export default function InscriptionList() {
  const { selectedCampaign } = useCatalogs();
  const { can } = usePermissions();
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [reviewTarget, setReviewTarget] = useState(null);

  const { status: loadStatus, data, errorCode, reload } = useInscriptionList({
    campaignId: selectedCampaign?.id ?? null,
    status,
    search,
    page,
    pageSize: PAGE_SIZE,
  });
  const { state: resolveState, run: resolve, reset: resetResolve } = useResolveInscription();

  const canReview = can("inscription.review") && canReviewInscriptions(selectedCampaign?.status);
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function handleStatusChange(event) {
    setStatus(event.target.value);
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
        <label className="field">
          <span className="field-label">{labels.inscription.filterStatus}</span>
          <select value={status} onChange={handleStatusChange}>
            <option value="">{labels.inscription.filterAll}</option>
            {STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {enumLabels.inscriptionStatus[option]}
              </option>
            ))}
          </select>
        </label>
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
            <ul className="records">
              {data.rows.map((row) => (
                <InscriptionRow
                  key={row.id}
                  row={row}
                  canReview={canReview}
                  onReview={(target, action) => setReviewTarget({ row: target, action })}
                />
              ))}
            </ul>
          )}

          {pages > 1 ? (
            <nav className="pager" aria-label={labels.inscription.listTitle}>
              <button
                type="button"
                className="button button-quiet"
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
              >
                {labels.inscription.pagePrevious}
              </button>
              <span>{labels.inscription.pageOf(page + 1, pages)}</span>
              <button
                type="button"
                className="button button-quiet"
                disabled={page + 1 >= pages}
                onClick={() => setPage(page + 1)}
              >
                {labels.inscription.pageNext}
              </button>
            </nav>
          ) : null}
        </>
      ) : loadStatus !== "error" ? (
        <p className="empty">{labels.app.loading}</p>
      ) : null}

      {reviewTarget ? (
        <ReasonDialog
          title={labels.inscription.reviewTitle[reviewTarget.action]}
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
        />
      ) : null}
    </section>
  );
}
