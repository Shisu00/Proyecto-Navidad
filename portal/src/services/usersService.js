import { supabase } from "../lib/supabaseClient.js";
import { unwrap } from "./rpc.js";

// La RLS de profiles devuelve solo las filas que el usuario puede ver:
// quien no tiene user.read recibe únicamente la propia
export async function fetchProfileNames(userIds) {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return new Map();
  const rows = unwrap(await supabase.from("profiles").select("id, full_name").in("id", ids));
  return new Map((rows ?? []).map((row) => [row.id, row.full_name]));
}
