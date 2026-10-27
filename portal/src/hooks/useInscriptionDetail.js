import * as deliveriesService from "../services/deliveriesService.js";
import * as inscriptionsService from "../services/inscriptionsService.js";
import { useAsyncData } from "./useAsyncData.js";

export function useDeliveryHistory(inscriptionId) {
  return useAsyncData(
    () => deliveriesService.listDeliveriesForInscription(inscriptionId),
    [inscriptionId],
  );
}

export function useRelatedInscriptions(row) {
  return useAsyncData(
    () =>
      inscriptionsService.listRelatedInscriptions({
        campaignId: row.campaign_id,
        beneficiaryId: row.beneficiary_id,
        excludeId: row.id,
      }),
    [row.id, row.campaign_id, row.beneficiary_id],
  );
}
