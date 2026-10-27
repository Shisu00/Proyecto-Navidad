import { BusinessError } from "../lib/errors.js";

// Las Edge Functions responden con el formato de negocio estándar (code/details)
export async function parseFunctionError(error) {
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
