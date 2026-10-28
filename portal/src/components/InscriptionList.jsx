import { useState } from "react";
import { usePermissions } from "../hooks/useAccount.jsx";
import { useCatalogs } from "../hooks/useCatalogs.jsx";
import { useInscriptionList, useResolveInscription } from "../hooks/useInscriptions.js";
import { canReviewInscriptions } from "../lib/campaignRules.js";
import {
  canCorrectInscription,
  getReviewActions,
  isReasonRequired,
} from "../lib/inscriptionRules.js";
import { enumLabels, errorMessage, labels } from "../lib/labels.js";
import ChoiceGroup from "./ChoiceGroup.jsx";
import IdSearch from "./IdSearch.jsx";
import InscriptionEditDialog from "./InscriptionEditDialog.jsx";
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
  const [editTarget, setEditTarget] = useState(null);
  const [notice, setNotice] = useState(null);

  const {
    status: loadStatus,
    data,
    errorCode,
    reload,
  } = useInscriptionList({
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
  const mayCorrect = can("inscription.update_own") || can("inscription.update_any");
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

  function handleCorrected(result) {
    setEditTarget(null);
    setNotice(
      result.status === "OBSERVED"
        ? labels.inscription.correctedReview
        : labels.inscription.correctedOk,
    );
    reload();
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

      {notice ? <Notice>{notice}</Notice> : null}

      {loadStatus === "error" ? (
        <div className="stack">
          <Notice tone="error">{errorMessage(errorCode)}</Notice>
          <button type="button" className="button button-primary" onClick={reload}>
            {labels.app.retry}
          </button>
        </div>
      ) : null}

      <div className="list-card">
        <div className="list-bar">
          <p className="list-total" aria-live="polite">
            <span className="list-total-label">{labels.inscription.totalLabel}</span>
            <strong>{data ? labels.inscription.total(total) : labels.app.loading}</strong>
          </p>
          <div className="list-tools">
            <label className="select-pill">
              <span className="visually-hidden">{labels.inscription.filterStatus}</span>
              <select value={status} onChange={handleStatusChange}>
                <option value="">{labels.inscription.filterStatusAll}</option>
                {STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {enumLabels.displayStatus[option]}
                  </option>
                ))}
              </select>
            </label>
            <label className="toggle-pill">
              <input type="checkbox" checked={hasObservation} onChange={handleObservationChange} />
              <span>{labels.inscription.filterObservation}</span>
            </label>
            <IdSearch onSearch={handleSearch} />
          </div>
        </div>

        {data ? (
          data.rows.length === 0 ? (
            <p className="empty list-empty">{labels.inscription.listEmpty}</p>
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
                    onCorrect={
                      mayCorrect &&
                      canCorrectInscription({
                        displayStatus: row.display_status,
                        campaignStatus: selectedCampaign?.status,
                      })
                        ? setEditTarget
                        : null
                    }
                    onReview={
                      canReview && getReviewActions(row.status, Boolean(row.delivery_id)).length > 0
                        ? openReview
                        : null
                    }
                  />
                ))}
              </tbody>
            </table>
          )
        ) : null}
      </div>

      {data ? (
        <Pager page={page} pages={pages} label={labels.inscription.listTitle} onPage={setPage} />
      ) : null}

      {detailTarget ? (
        <InscriptionDetailDialog
          row={detailTarget}
          onClose={() => setDetailTarget(null)}
          onOpenRelated={setDetailTarget}
        />
      ) : null}

      {editTarget ? (
        <InscriptionEditDialog
          row={editTarget}
          cutoffDate={selectedCampaign?.age_cutoff_date}
          onSaved={handleCorrected}
          onCancel={() => setEditTarget(null)}
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
