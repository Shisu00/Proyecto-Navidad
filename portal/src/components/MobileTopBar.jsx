import { useState } from "react";
import { useEscapeKey } from "../hooks/useEscapeKey.js";
import { enumLabels, labels } from "../lib/labels.js";

function initialOf(name) {
  return (name ?? "").trim().charAt(0).toUpperCase() || "?";
}

// Encabezado compacto del teléfono: nombre, campaña y menú de cuenta
export default function MobileTopBar({
  fullName,
  campaigns,
  selectedCampaignId,
  onSelectCampaign,
  onSignOut,
}) {
  const [isOpen, setIsOpen] = useState(false);
  useEscapeKey(isOpen, () => setIsOpen(false));

  return (
    <div className="mobile-top">
      <strong className="mobile-top-title">{labels.app.name}</strong>

      {campaigns.length > 0 ? (
        <label className="mobile-campaign">
          <span className="visually-hidden">{labels.campaign.selectLabel}</span>
          <select
            value={selectedCampaignId}
            onChange={(event) => onSelectCampaign(event.target.value)}
          >
            {campaigns.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.name} ({enumLabels.campaignStatus[campaign.status]})
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <button
        type="button"
        className="mobile-avatar"
        aria-label={labels.nav.account}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((previous) => !previous)}
      >
        {initialOf(fullName)}
      </button>

      {isOpen ? (
        <>
          <button
            type="button"
            className="mobile-backdrop"
            aria-label={labels.nav.closeMenu}
            tabIndex={-1}
            onClick={() => setIsOpen(false)}
          />
          <div className="mobile-account" role="group" aria-label={labels.nav.account}>
            <p className="mobile-account-name">{fullName}</p>
            <button type="button" className="mobile-account-action" onClick={onSignOut}>
              {labels.nav.signOut}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
