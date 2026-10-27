import { useState } from "react";
import { useCampaignTransition } from "../hooks/useCampaignTransition.js";
import { useCatalogs } from "../hooks/useCatalogs.jsx";
import {
  CAMPAIGN_STATUSES,
  nextCampaignStatus,
  previousCampaignStatus,
} from "../lib/campaignRules.js";
import { enumLabels, labels } from "../lib/labels.js";
import Notice from "./Notice.jsx";
import ReasonDialog from "./ReasonDialog.jsx";

export default function CampaignAdmin() {
  const { selectedCampaign, reload } = useCatalogs();
  const { state, run, reset } = useCampaignTransition();
  const [pendingChange, setPendingChange] = useState(null);

  if (!selectedCampaign) return <Notice>{labels.campaign.empty}</Notice>;

  const next = nextCampaignStatus(selectedCampaign.status);
  const previous = previousCampaignStatus(selectedCampaign.status);
  const stateLabel = (status) => enumLabels.campaignStatus[status];

  function closeDialog() {
    setPendingChange(null);
    reset();
  }

  async function confirm(reason) {
    const result = await run({
      campaignId: selectedCampaign.id,
      targetStatus: pendingChange.target,
      reason,
    });
    if (result.status === "success") {
      closeDialog();
      reload();
    }
  }

  const isRollback = pendingChange?.kind === "rollback";

  return (
    <section className="panel stack-large" aria-labelledby="campaign-title">
      <div className="stack">
        <h2 id="campaign-title">{labels.campaign.stateTitle}</h2>
        <p>{labels.campaign.stateIntro}</p>
      </div>

      <ol className="steps">
        {CAMPAIGN_STATUSES.map((status) => (
          <li
            key={status}
            className="step"
            aria-current={status === selectedCampaign.status ? "step" : undefined}
          >
            <strong>{stateLabel(status)}</strong>
            <span>{labels.campaign.effects[status]}</span>
          </li>
        ))}
      </ol>

      {next === null && previous === null ? <Notice>{labels.campaign.terminal}</Notice> : null}

      <div className="actions">
        {next ? (
          <button
            type="button"
            className="button button-primary"
            onClick={() => setPendingChange({ kind: "advance", target: next })}
          >
            {labels.campaign.advance(stateLabel(next))}
          </button>
        ) : null}
        {previous ? (
          <button
            type="button"
            className="button button-quiet"
            onClick={() => setPendingChange({ kind: "rollback", target: previous })}
          >
            {labels.campaign.rollback(stateLabel(previous))}
          </button>
        ) : null}
      </div>

      {pendingChange ? (
        <ReasonDialog
          title={
            isRollback
              ? labels.campaign.rollbackTitle(stateLabel(pendingChange.target))
              : labels.campaign.advanceTitle(stateLabel(pendingChange.target))
          }
          description={
            isRollback ? labels.campaign.rollbackDescription : labels.campaign.advanceDescription
          }
          reasonLabel={isRollback ? labels.campaign.reasonLabel : labels.campaign.noteLabel}
          confirmLabel={isRollback ? labels.campaign.confirmRollback : labels.campaign.confirmAdvance}
          isRequired={isRollback}
          isPending={state.status === "pending"}
          errorCode={state.status === "error" ? state.error.code : null}
          onConfirm={confirm}
          onCancel={closeDialog}
        />
      ) : null}
    </section>
  );
}
