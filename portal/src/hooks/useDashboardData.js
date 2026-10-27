import * as reportsService from "../services/reportsService.js";
import { useAsyncData } from "./useAsyncData.js";

// El avance por territorio y la planificación requieren planning.read; el resumen
// llega filtrado por la RLS de quien consulta.
export function useDashboardData(campaignId, canReadPlanning) {
  return useAsyncData(async () => {
    if (!campaignId) return null;
    const [summary, progress, planning] = await Promise.all([
      reportsService.getCampaignSummary(campaignId),
      canReadPlanning ? reportsService.getDeliveryProgress(campaignId) : [],
      canReadPlanning ? reportsService.getPlanningCounts(campaignId) : [],
    ]);
    return { summary, progress, planning };
  }, [campaignId, canReadPlanning]);
}
