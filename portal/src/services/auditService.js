import { toBusinessError } from "../lib/errors.js";
import { supabase } from "../lib/supabaseClient.js";
import { fetchProfileNames } from "./usersService.js";

const AUDIT_COLUMNS =
  "id, occurred_at, actor_user_id, action, entity_type, entity_id, previous_state, new_state, reason";

export async function listAuditLog({ action, page, pageSize }) {
  const from = page * pageSize;
  let query = supabase
    .from("audit_log")
    .select(AUDIT_COLUMNS, { count: "exact" })
    .order("occurred_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, from + pageSize - 1);

  if (action) query = query.eq("action", action);

  const { data, error, count } = await query;
  if (error) throw toBusinessError(error);

  const rows = data ?? [];
  const names = await fetchProfileNames(rows.map((row) => row.actor_user_id));
  return {
    rows: rows.map((row) => ({ ...row, actorName: names.get(row.actor_user_id) ?? null })),
    total: count ?? 0,
  };
}
