import { BusinessError, toBusinessError } from "../lib/errors.js";
import { supabase } from "../lib/supabaseClient.js";

const INVALID_CREDENTIALS_CODE = "invalid_credentials";

export function onAuthChange(callback) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session));
  return () => data.subscription.unsubscribe();
}

export async function signIn({ email, password }) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (!error) return;
  if (error.code === INVALID_CREDENTIALS_CODE) throw new BusinessError("INVALID_CREDENTIALS");
  throw toBusinessError(error);
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw toBusinessError(error);
}

// La Edge Function responde con el formato de negocio estándar (code/details)
async function parseFunctionError(error) {
  const response = error?.context;
  if (response && typeof response.json === "function") {
    try {
      const body = await response.json();
      const code = body?.code ?? body?.error?.code;
      if (code) return new BusinessError(code, body?.details ?? body?.error?.details ?? {});
    } catch {
      // cuerpo no JSON: se informa como error inesperado
    }
  }
  return new BusinessError("UNKNOWN");
}

export async function changePassword({ email, newPassword, currentPassword }) {
  const { error } = await supabase.functions.invoke("change-password", {
    body: { new_password: newPassword, current_password: currentPassword ?? null },
  });
  if (error) throw await parseFunctionError(error);
  // Cambiar la clave invalida la sesión previa: se abre una nueva con la clave nueva
  try {
    await signIn({ email, password: newPassword });
  } catch (caught) {
    // La clave ya cambió en el servidor: se informa para no dejar al usuario atascado
    await supabase.auth.signOut();
    throw new BusinessError("PASSWORD_CHANGED_SIGN_IN_REQUIRED", { cause: caught.code });
  }
}
