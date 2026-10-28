import {
  buildDailySeries,
  buildWeeklySeries,
  normalizeProjectionRows,
  summarizeProjection,
} from "../lib/analyticsStats.js";
import * as analyticsService from "../services/analyticsService.js";
import { useAsyncData } from "./useAsyncData.js";

export function useAnalytics(campaignId) {
  return useAsyncData(async () => {
    if (!campaignId) return null;
    const [weekly, daily, projection] = await Promise.all([
      analyticsService.getInscriptionWeekly(campaignId),
      analyticsService.getDeliveryDaily(campaignId),
      analyticsService.getPurchaseProjection(campaignId),
    ]);
    return {
      weekly: buildWeeklySeries(weekly),
      daily: buildDailySeries(daily),
      projection: summarizeProjection(normalizeProjectionRows(projection)),
    };
  }, [campaignId]);
}
