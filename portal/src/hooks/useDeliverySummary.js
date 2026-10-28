import * as reportsService from "../services/reportsService.js";
import { useRealtimeDeliveries } from "./useRealtimeDeliveries.js";
import { useAsyncData } from "./useAsyncData.js";

// Entregados y pendientes de lo que el usuario puede ver (su JJVV, o toda la campaña)
export function useDeliverySummary(campaignId) {
  const result = useAsyncData(async () => {
    if (!campaignId) return null;
    return reportsService.getCampaignSummary(campaignId);
  }, [campaignId]);
  useRealtimeDeliveries(campaignId, result.reload);
  return result;
}
