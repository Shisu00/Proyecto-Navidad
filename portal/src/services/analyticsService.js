import { callRpc } from "./rpc.js";

export function getInscriptionWeekly(campaignId) {
  return callRpc("get_inscription_weekly", { p_campaign_id: campaignId });
}

export function getDeliveryDaily(campaignId) {
  return callRpc("get_delivery_daily", { p_campaign_id: campaignId });
}

export function getPurchaseProjection(campaignId) {
  return callRpc("get_purchase_projection", { p_campaign_id: campaignId });
}
