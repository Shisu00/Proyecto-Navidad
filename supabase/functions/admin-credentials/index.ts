// Alta de cuentas y claves temporales (SPECS §4.3). Usa service_role: nunca debe llegar al navegador.
// El llamador se identifica con su JWT; los permisos y la anti-escalación los decide la base
// mediante RPC ejecutadas con ese mismo JWT, no con service_role.
import { createClient } from "npm:@supabase/supabase-js@2.50.0";

const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // sin I ni O
const LOWER = "abcdefghijkmnpqrstuvwxyz"; // sin l ni o
const DIGITS = "23456789"; // sin 0 ni 1
const TEMP_PASSWORD_LENGTH = 12;

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BUSINESS_CODE = /^[A-Z][A-Z0-9_]+$/;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

class BusinessError extends Error {
  constructor(
    public code: string,
    public status: number,
    public details: Record<string, unknown> = {},
  ) {
    super(code);
  }
}

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    // La respuesta puede contener una clave temporal: nunca se guarda en caché
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function statelessClient(key: string, authorization?: string) {
  return createClient(Deno.env.get("SUPABASE_URL")!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: authorization ? { headers: { Authorization: authorization } } : undefined,
  });
}

// Entero aleatorio uniforme en [0, max) sin sesgo de módulo
function randomIndex(max: number): number {
  const limit = Math.floor(0x100000000 / max) * max;
  const buffer = new Uint32Array(1);
  do {
    crypto.getRandomValues(buffer);
  } while (buffer[0] >= limit);
  return buffer[0] % max;
}

function pick(set: string): string {
  return set[randomIndex(set.length)];
}

export function generateTemporaryPassword(): string {
  const all = UPPER + LOWER + DIGITS;
  const chars = [pick(UPPER), pick(LOWER), pick(DIGITS)];
  while (chars.length < TEMP_PASSWORD_LENGTH) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

// Los errores de negocio de las RPC llegan como message = código, details = JSON
function throwRpcError(error: { message?: string; details?: string; code?: string }): never {
  const message = error.message ?? "";
  if (BUSINESS_CODE.test(message)) {
    let details: Record<string, unknown> = {};
    try {
      details = JSON.parse(error.details ?? "{}");
    } catch {
      // details no siempre es JSON
    }
    const status = message === "UNAUTHORIZED"
      ? 401
      : message === "FORBIDDEN" || message === "PASSWORD_CHANGE_REQUIRED"
      ? 403
      : message === "NOT_FOUND"
      ? 404
      : 400;
    throw new BusinessError(message, status, details);
  }
  throw new Error(`RPC_FAILED:${error.code ?? ""}`);
}

function optionalUuid(value: unknown, field: string): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw new BusinessError("VALIDATION_ERROR", 400, { field });
  }
  return value;
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    if (body && typeof body === "object") return body as Record<string, unknown>;
  } catch {
    // cae al error de validación
  }
  throw new BusinessError("VALIDATION_ERROR", 400);
}

async function createUser(
  caller: ReturnType<typeof statelessClient>,
  admin: ReturnType<typeof statelessClient>,
  body: Record<string, unknown>,
): Promise<Response> {
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const fullName = typeof body.full_name === "string" ? body.full_name.trim() : "";
  const roleId = optionalUuid(body.role_id, "role_id");
  const territoryId = optionalUuid(body.territory_id, "territory_id");
  const councilId = optionalUuid(body.council_id, "council_id");

  if (!EMAIL_PATTERN.test(email)) {
    throw new BusinessError("VALIDATION_ERROR", 400, { field: "email" });
  }
  if (!fullName) throw new BusinessError("VALIDATION_ERROR", 400, { field: "full_name" });
  if (!roleId) throw new BusinessError("VALIDATION_ERROR", 400, { field: "role_id" });

  // Antes de crear nada en Auth: permiso y anti-escalación con el JWT del llamador
  const { data: canManage, error: permissionError } = await caller.rpc("admin_can_manage_role", {
    p_role_id: roleId,
  });
  if (permissionError) throwRpcError(permissionError);
  if (!canManage) throw new BusinessError("FORBIDDEN", 403, { reason: "ROLE_NOT_ASSIGNABLE" });

  const temporaryPassword = generateTemporaryPassword();
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: temporaryPassword,
    email_confirm: true,
  });
  if (createError || !created?.user) {
    if (createError?.code === "email_exists" || createError?.status === 422) {
      throw new BusinessError("VALIDATION_ERROR", 400, { field: "email", reason: "EMAIL_TAKEN" });
    }
    throw new Error(`USER_CREATE_FAILED:${createError?.status ?? ""}:${createError?.code ?? ""}`);
  }
  const userId = created.user.id;

  const { error: profileError } = await caller.rpc("admin_create_profile", {
    p_user_id: userId,
    p_full_name: fullName,
    p_role_id: roleId,
    p_territory_id: territoryId,
    p_council_id: councilId,
  });

  if (profileError) {
    // Compensación: una cuenta de Auth sin perfil no sirve para nada
    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    if (deleteError) console.error("admin-credentials: orphan auth user", userId);
    throwRpcError(profileError);
  }

  return jsonResponse(200, { ok: true, user_id: userId, temporary_password: temporaryPassword });
}

async function resetPassword(
  caller: ReturnType<typeof statelessClient>,
  admin: ReturnType<typeof statelessClient>,
  body: Record<string, unknown>,
): Promise<Response> {
  const userId = optionalUuid(body.user_id, "user_id");
  if (!userId) throw new BusinessError("VALIDATION_ERROR", 400, { field: "user_id" });

  // Autoriza y sube must_change_password antes de tocar la clave
  const { error: markError } = await caller.rpc("admin_mark_password_reset", {
    p_user_id: userId,
  });
  if (markError) throwRpcError(markError);

  const temporaryPassword = generateTemporaryPassword();
  const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
    password: temporaryPassword,
  });
  if (updateError) {
    throw new Error(`PASSWORD_UPDATE_FAILED:${updateError.status ?? ""}:${updateError.code ?? ""}`);
  }

  return jsonResponse(200, { ok: true, user_id: userId, temporary_password: temporaryPassword });
}

async function handle(request: Request): Promise<Response> {
  const authorization = request.headers.get("Authorization");
  if (!authorization) throw new BusinessError("UNAUTHORIZED", 401);

  const caller = statelessClient(Deno.env.get("SUPABASE_ANON_KEY")!, authorization);
  const { data: userData, error: userError } = await caller.auth.getUser();
  if (userError || !userData?.user) throw new BusinessError("UNAUTHORIZED", 401);

  const body = await readBody(request);
  const admin = statelessClient(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  switch (body.action) {
    case "create_user":
      return await createUser(caller, admin, body);
    case "reset_password":
      return await resetPassword(caller, admin, body);
    default:
      throw new BusinessError("VALIDATION_ERROR", 400, { field: "action" });
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse(405, { code: "VALIDATION_ERROR" });

  try {
    return await handle(request);
  } catch (error) {
    if (error instanceof BusinessError) {
      return jsonResponse(error.status, { code: error.code, details: error.details });
    }
    // Solo se registra el paso que falló: nunca claves, correos ni tokens
    console.error("admin-credentials failed:", error instanceof Error ? error.message : "unknown");
    return jsonResponse(500, { code: "UNKNOWN", details: {} });
  }
});
