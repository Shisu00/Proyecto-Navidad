import { supabase } from "../lib/supabaseClient.js";
import { toBusinessError } from "../lib/errors.js";
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

// search llega normalizado (solo dígitos y K), por eso es seguro dentro del filtro
export async function listInscriptions({
  campaignId,
  status,
  displayStatus,
  hasObservation,
  search,
  page,
  pageSize,
}) {
  const from = page * pageSize;
  let query = supabase
    .from("inscription_overview")
    .select(LIST_COLUMNS, { count: "exact" })
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);

  if (status) query = query.eq("status", status);
  if (displayStatus) query = query.eq("display_status", displayStatus);
  if (hasObservation) query = query.eq("has_observation", true);
  if (search) {
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
