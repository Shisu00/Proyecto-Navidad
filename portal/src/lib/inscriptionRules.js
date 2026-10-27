export const REVIEW_ACTIONS = Object.freeze({
  VALIDATE: "VALIDATE",
  OBSERVE: "OBSERVE",
  DISCARD: "DISCARD",
});

export const MIN_REASON_LENGTH = 10;

const TRANSITIONS = {
  PENDING: ["VALIDATE", "OBSERVE", "DISCARD"],
  OBSERVED: ["VALIDATE", "DISCARD"],
  VALIDATED: ["OBSERVE", "DISCARD"],
  DISCARDED: [],
};

// Una inscripción con entrega vigente no puede pasar a OBSERVED ni DISCARDED (SPECS §8.3)
export function getReviewActions(status, hasActiveDelivery) {
  const actions = TRANSITIONS[status] ?? [];
  if (!hasActiveDelivery) return actions;
  return actions.filter((action) => action === REVIEW_ACTIONS.VALIDATE);
}

export function isReasonRequired(status, action) {
  return !(status === "PENDING" && action === REVIEW_ACTIONS.VALIDATE);
}
