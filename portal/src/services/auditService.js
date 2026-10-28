import { BusinessError, toBusinessError } from "../lib/errors.js";
import { supabase } from "../lib/supabaseClient.js";
import { actionsInCategory, KNOWN_ACTIONS, OTHER_CATEGORY } from "../lib/auditCategories.js";
import { dateRangeToIso, SYSTEM_ACTOR } from "../lib/auditLog.js";
import { fetchAllRows, MAX_EXPORT_ROWS } from "./exportRows.js";
import { callRpc } from "./rpc.js";
import { fetchProfileNames } from "./usersService.js";

const AUDIT_COLUMNS =
  "id, occurred_at, actor_user_id, action, entity_type, entity_id, previous_state, new_state, reason";

const EXPORT_COLUMNS = [
  AUDIT_COLUMNS,
  "beneficiary_run",
  "previous_beneficiary_run",
  "guardian_run",
  "previous_guardian_run",
  "withdrawer_run",
].join(", ");

// Filtros del visor: categoría, tipo de acción, rango de fechas y persona.
// El listado y la exportación usan exactamente los mismos.
function applyFilters(query, { category, action, from, to, actorId }) {
  let result = query;

  if (action) result = result.eq("action", action);
  else if (category === OTHER_CATEGORY) {
    result = result.not("action", "in", `(${KNOWN_ACTIONS.join(",")})`);
  } else if (category) result = result.in("action", actionsInCategory(category));

  const { fromIso, toIso } = dateRangeToIso({ from, to });
  if (fromIso) result = result.gte("occurred_at", fromIso);
  if (toIso) result = result.lt("occurred_at", toIso);

  if (actorId === SYSTEM_ACTOR) result = result.is("actor_user_id", null);
  else if (actorId) result = result.eq("actor_user_id", actorId);

  return result;
}

async function withActorNames(rows) {
  const names = await fetchProfileNames(rows.map((row) => row.actor_user_id));
  return rows.map((row) => ({ ...row, actorName: names.get(row.actor_user_id) ?? null }));
}

export async function listAuditLog({ filters, page, pageSize }) {
  const from = page * pageSize;
  const query = applyFilters(
    supabase.from("audit_log").select(AUDIT_COLUMNS, { count: "exact" }),
    filters,
  )
    .order("occurred_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, from + pageSize - 1);

  const { data, error, count } = await query;
  if (error) throw toBusinessError(error);

  return { rows: await withActorNames(data ?? []), total: count ?? 0 };
}

// Trae todo el resultado filtrado desde la vista con los RUN resueltos
export async function exportAuditLog(filters, { total, onProgress }) {
  if (total > MAX_EXPORT_ROWS) throw new BusinessError("EXPORT_TOO_LARGE");

  const rows = await fetchAllRows({
    build: () => applyFilters(supabase.from("audit_log_export").select(EXPORT_COLUMNS), filters),
    keyColumn: "id",
    descending: true,
    maxRows: MAX_EXPORT_ROWS,
    onProgress,
  });

  const named = await withActorNames(rows);
  // Mismo orden que el visor: más reciente primero
  named.sort(
    (a, b) => b.occurred_at.localeCompare(a.occurred_at) || Number(b.id) - Number(a.id),
  );
  return named;
}

export function registerAuditExport(filters, rowCount) {
  return callRpc("register_audit_export", { p_filters: filters, p_row_count: rowCount });
}
