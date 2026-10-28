import { supabase } from "../lib/supabaseClient.js";
import { BusinessError, toBusinessError } from "../lib/errors.js";
import { isNameSearch } from "../lib/searchQuery.js";
import { callRpc } from "./rpc.js";

const LIST_COLUMNS = [
  "id",
  "campaign_id",
  "beneficiary_id",
  "status",
  "display_status",
  "created_at",
  "council_name",
  "territory_name",
  "beneficiary_id_type",
  "beneficiary_id_number",
  "sex",
  "birth_date",
  "age_at_cutoff",
  "age_range",
  "guardian_full_name",
  "guardian_id_number",
  "guardian_email",
  "guardian_phone",
  "duplicate_justification",
  "has_observation",
  "open_cases_count",
  "delivery_id",
  "delivered_at",
].join(", ");

export async function submitInscription(input) {
  return callRpc("submit_inscription", {
    p_client_operation_id: input.clientOperationId,
    p_campaign_id: input.campaignId,
    p_beneficiary_id_type: input.beneficiaryIdType,
    p_beneficiary_id_number: input.beneficiaryIdNumber,
    p_sex: input.sex,
    p_birth_date: input.birthDate,
    p_guardian_full_name: input.guardianFullName,
    p_guardian_id_number: input.guardianIdNumber,
    p_guardian_email: input.guardianEmail,
    p_guardian_phone: input.guardianPhone,
    p_duplicate_justification: input.duplicateJustification,
    p_council_id: input.councilId,
  });
}

export async function updateInscription(input) {
  return callRpc("update_inscription", {
    p_inscription_id: input.inscriptionId,
    p_reason: input.reason,
    p_beneficiary_id_type: input.beneficiaryIdType,
    p_beneficiary_id_number: input.beneficiaryIdNumber,
    p_sex: input.sex,
    p_birth_date: input.birthDate,
    p_guardian_full_name: input.guardianFullName,
    p_guardian_id_number: input.guardianIdNumber,
    p_guardian_email: input.guardianEmail,
    p_guardian_phone: input.guardianPhone,
    p_duplicate_justification: input.duplicateJustification,
  });
}

export async function resolveInscription({ inscriptionId, action, reason }) {
  return callRpc("resolve_inscription", {
    p_inscription_id: inscriptionId,
    p_action: action,
    p_reason: reason ?? null,
  });
}

// search llega normalizado (solo dígitos y K, o minúsculas y espacios), por eso es seguro dentro del filtro
export async function listInscriptions({
  campaignId,
  status,
  displayStatus,
  hasObservation,
  search,
  pendingDeliveryFirst = false,
  page,
  pageSize,
}) {
  const from = page * pageSize;
  let query = supabase
    .from("inscription_overview")
    .select(LIST_COLUMNS, { count: "exact" })
    .eq("campaign_id", campaignId);

  // Sin entrega (delivered_at nulo) primero; luego las entregadas, la más reciente arriba
  if (pendingDeliveryFirst) {
    query = query.order("delivered_at", { ascending: false, nullsFirst: true });
  }
  query = query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, from + pageSize - 1);

  if (status) query = query.eq("status", status);
  if (displayStatus) query = query.eq("display_status", displayStatus);
  if (hasObservation) query = query.eq("has_observation", true);
  if (search && isNameSearch(search)) {
    // Cada palabra debe aparecer en el nombre del adulto, en cualquier orden
    for (const word of search.split(" ")) {
      query = query.ilike("guardian_search_name", `%${word}%`);
    }
  } else if (search) {
    query = query.or(`beneficiary_id_number.ilike.${search}%,guardian_id_number.ilike.${search}%`);
  }

  const { data, error, count } = await query;
  if (error) throw toBusinessError(error);
  return { rows: data ?? [], total: count ?? 0 };
}

// La RLS limita el resultado: una JJVV no ve inscripciones de otra (SPECS §8.2)
export async function listRelatedInscriptions({ campaignId, beneficiaryId, excludeId }) {
  const { data, error } = await supabase
    .from("inscription_overview")
    .select(LIST_COLUMNS)
    .eq("campaign_id", campaignId)
    .eq("beneficiary_id", beneficiaryId)
    .neq("id", excludeId)
    .order("created_at", { ascending: true });
  if (error) throw toBusinessError(error);
  return data ?? [];
}

export const MAX_BATCH_DELIVERY = 20;

// Todos los regalos que le faltan a un adulto en la campaña (no solo los que muestra la búsqueda)
export async function listPendingByGuardian({ campaignId, guardianIdNumber }) {
  const { data, error } = await supabase
    .from("inscription_overview")
    .select(LIST_COLUMNS)
    .eq("campaign_id", campaignId)
    .eq("status", "VALIDATED")
    .eq("guardian_id_number", guardianIdNumber)
    .is("delivery_id", null)
    .order("created_at", { ascending: true })
    .limit(MAX_BATCH_DELIVERY + 1);
  if (error) throw toBusinessError(error);
  if ((data ?? []).length > MAX_BATCH_DELIVERY) throw new BusinessError("BATCH_TOO_LARGE");
  return data ?? [];
}
