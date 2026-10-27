import { toBusinessError } from "../lib/errors.js";
import { supabase } from "../lib/supabaseClient.js";

export function unwrap({ data, error }) {
  if (error) throw toBusinessError(error);
  return data;
}

export async function callRpc(name, args) {
  return unwrap(await supabase.rpc(name, args));
}
