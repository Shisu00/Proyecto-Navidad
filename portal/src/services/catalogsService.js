import { supabase } from "../lib/supabaseClient.js";
import { callRpc, unwrap } from "./rpc.js";

export async function fetchCatalogs() {
  const [campaigns, territories, councils] = await Promise.all([
    supabase
      .from("campaigns")
      .select("id, year, name, status, age_cutoff_date")
      .order("year", { ascending: false }),
    supabase.from("territories").select("id, name, is_active").order("name"),
    supabase.from("neighborhood_councils").select("id, name, territory_id, is_active").order("name"),
  ]);

  return {
    campaigns: unwrap(campaigns) ?? [],
    territories: unwrap(territories) ?? [],
    councils: unwrap(councils) ?? [],
  };
}

export async function transitionCampaign({ campaignId, targetStatus, reason }) {
  return callRpc("admin_transition_campaign", {
    p_campaign_id: campaignId,
    p_target_status: targetStatus,
    p_reason: reason ?? null,
  });
}
