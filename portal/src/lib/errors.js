const BUSINESS_CODE = /^[A-Z][A-Z0-9_]+$/;

export class BusinessError extends Error {
  constructor(code, details = {}) {
    super(code);
    this.name = "BusinessError";
    this.code = code;
    this.details = details;
  }
}

function parseDetails(raw) {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    // details no siempre es JSON (errores de PostgREST): se ignora
    return {};
  }
}

// Traduce errores de PostgREST/Supabase al formato de negocio (message = código)
export function toBusinessError(error) {
  if (error instanceof BusinessError) return error;
  const message = error?.message ?? "";
  if (BUSINESS_CODE.test(message)) {
    return new BusinessError(message, parseDetails(error.details));
  }
  if (error?.code === "PGRST301" || error?.status === 401) {
    return new BusinessError("UNAUTHORIZED");
  }
  if (error?.code === "PGRST116") {
    return new BusinessError("NOT_FOUND");
  }
  return new BusinessError("UNKNOWN");
}
