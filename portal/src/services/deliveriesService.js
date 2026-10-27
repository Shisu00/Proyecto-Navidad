import { supabase } from "../lib/supabaseClient.js";
import { callRpc } from "./rpc.js";

// La suscripción respeta la RLS de deliveries: cada usuario recibe solo lo que puede ver
export function subscribeToDeliveries(campaignId, onChange) {
  const channel = supabase
    .channel(`deliveries-${campaignId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "deliveries", filter: `campaign_id=eq.${campaignId}` },
      onChange,
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export async function confirmDelivery(input) {
  return callRpc("confirm_delivery", {
    p_inscription_id: input.inscriptionId,
    p_withdrawal_type: input.withdrawalType,
    p_withdrawer_id_number: input.withdrawerIdNumber,
    p_observation: input.observation,
    p_responsibility_confirmed: input.responsibilityConfirmed,
    p_scanned: input.scanned,
  });
}

export async function voidDelivery({ deliveryId, reason }) {
  return callRpc("void_delivery", { p_delivery_id: deliveryId, p_reason: reason });
}
