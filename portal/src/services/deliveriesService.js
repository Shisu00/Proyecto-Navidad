import { supabase } from "../lib/supabaseClient.js";
import { callRpc, unwrap } from "./rpc.js";
import { fetchProfileNames } from "./usersService.js";

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

const DELIVERY_COLUMNS = [
  "id",
  "delivered_at",
  "delivered_by_user_id",
  "withdrawal_type",
  "withdrawer_id_number",
  "observation",
  "scanned_from_id_card",
  "voided_at",
  "voided_by_user_id",
  "void_reason",
].join(", ");

// Incluye las entregas anuladas: el historial completo de la inscripción
export async function listDeliveriesForInscription(inscriptionId) {
  const rows =
    unwrap(
      await supabase
        .from("deliveries")
        .select(DELIVERY_COLUMNS)
        .eq("inscription_id", inscriptionId)
        .order("delivered_at", { ascending: false }),
    ) ?? [];

  const names = await fetchProfileNames(
    rows.flatMap((row) => [row.delivered_by_user_id, row.voided_by_user_id]),
  );
  return rows.map((row) => ({
    ...row,
    deliveredByName: names.get(row.delivered_by_user_id) ?? null,
    voidedByName: names.get(row.voided_by_user_id) ?? null,
  }));
}
