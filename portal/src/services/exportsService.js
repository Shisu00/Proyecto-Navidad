import { supabase } from "../lib/supabaseClient.js";
import { fetchAllRows } from "./exportRows.js";
import { callRpc } from "./rpc.js";

const INSCRIPTION_COLUMNS = [
  "id",
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
  "display_status",
  "has_observation",
  "open_cases_count",
  "duplicate_justification",
  "delivered_at",
].join(", ");

const DELIVERY_COLUMNS = [
  "id",
  "delivered_at",
  "council_name",
  "territory_name",
  "withdrawal_type",
  "withdrawer_id_number",
  "beneficiary_id_type",
  "beneficiary_id_number",
  "guardian_full_name",
  "guardian_id_number",
  "delivered_by_name",
  "observation",
  "responsibility_confirmed",
  "scanned_from_id_card",
  "is_voided",
  "voided_at",
  "voided_by_name",
  "void_reason",
].join(", ");

export function exportInscriptions({ campaignId, displayStatus, councilId }, { onProgress }) {
  return fetchAllRows({
    build: () => {
      let query = supabase
        .from("inscription_overview")
        .select(INSCRIPTION_COLUMNS)
        .eq("campaign_id", campaignId);
      if (displayStatus) query = query.eq("display_status", displayStatus);
      if (councilId) query = query.eq("council_id", councilId);
      return query;
    },
    keyColumn: "id",
    onProgress,
  });
}

export function exportDeliveries({ campaignId, councilId, onlyActive }, { onProgress }) {
  return fetchAllRows({
    build: () => {
      let query = supabase
        .from("delivery_report")
        .select(DELIVERY_COLUMNS)
        .eq("campaign_id", campaignId);
      if (councilId) query = query.eq("council_id", councilId);
      if (onlyActive) query = query.eq("is_voided", false);
      return query;
    },
    keyColumn: "id",
    onProgress,
  });
}

export function registerDataExport(report, filters, rowCount) {
  return callRpc("register_data_export", {
    p_report: report,
    p_filters: filters,
    p_row_count: rowCount,
  });
}
