// El orden define el avance de la campaña (SPECS §9.2)
export const CAMPAIGN_STATUSES = Object.freeze([
  "PLANNED",
  "REGISTRATION_OPEN",
  "REGISTRATION_CLOSED",
  "VALIDATION",
  "DELIVERY_PLANNED",
  "DELIVERY",
  "CLOSED",
]);

const CLOSED_STATUS = "CLOSED";
const FIRST_STATUS = "PLANNED";

export function nextCampaignStatus(status) {
  if (status === CLOSED_STATUS) return null;
  const index = CAMPAIGN_STATUSES.indexOf(status);
  return index === -1 ? null : CAMPAIGN_STATUSES[index + 1];
}

export function previousCampaignStatus(status) {
  if (status === CLOSED_STATUS || status === FIRST_STATUS) return null;
  const index = CAMPAIGN_STATUSES.indexOf(status);
  return index <= 0 ? null : CAMPAIGN_STATUSES[index - 1];
}

export function canRegisterInscriptions(status) {
  return status === "REGISTRATION_OPEN";
}

// Revisión municipal: desde REGISTRATION_OPEN hasta DELIVERY
export function canReviewInscriptions(status) {
  const index = CAMPAIGN_STATUSES.indexOf(status);
  return index >= CAMPAIGN_STATUSES.indexOf("REGISTRATION_OPEN") && status !== CLOSED_STATUS;
}

export function pickDefaultCampaign(campaigns) {
  if (campaigns.length === 0) return null;
  const sorted = [...campaigns].sort((a, b) => b.year - a.year);
  return sorted.find((campaign) => campaign.status !== CLOSED_STATUS) ?? sorted[0];
}
