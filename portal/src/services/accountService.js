import { supabase } from "../lib/supabaseClient.js";
import { callRpc, unwrap } from "./rpc.js";

async function fetchProfile(userId) {
  return unwrap(
    await supabase
      .from("profiles")
      .select("full_name, territory_id, council_id")
      .eq("id", userId)
      .single(),
  );
}

// my_permissions() y la fila propia de profiles funcionan aun con clave temporal pendiente
export async function fetchAccount(userId) {
  const [access, profile] = await Promise.all([callRpc("my_permissions"), fetchProfile(userId)]);
  return {
    permissions: Array.isArray(access?.permissions) ? access.permissions : [],
    mustChangePassword: Boolean(access?.must_change_password),
    profile,
  };
}
