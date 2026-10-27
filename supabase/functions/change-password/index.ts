// Cambio de clave (SPECS §4.3). Usa service_role: nunca debe llegar al navegador.
import { createClient } from "npm:@supabase/supabase-js@2.50.0";

const MIN_PASSWORD_LENGTH = 10;

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
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function statelessClient(key: string, authorization?: string) {
  return createClient(Deno.env.get("SUPABASE_URL")!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: authorization ? { headers: { Authorization: authorization } } : undefined,
  });
}

async function canSignIn(email: string, password: string): Promise<boolean> {
  const anon = statelessClient(Deno.env.get("SUPABASE_ANON_KEY")!);
  const { error } = await anon.auth.signInWithPassword({ email, password });
  return !error;
}

async function parseBody(request: Request) {
  try {
    const body = await request.json();
    return {
      newPassword: typeof body?.new_password === "string" ? body.new_password : "",
      currentPassword: typeof body?.current_password === "string" ? body.current_password : null,
    };
  } catch {
    throw new BusinessError("VALIDATION_ERROR", 400);
  }
}

async function handle(request: Request): Promise<Response> {
  const authorization = request.headers.get("Authorization");
  if (!authorization) throw new BusinessError("UNAUTHORIZED", 401);

  const caller = statelessClient(Deno.env.get("SUPABASE_ANON_KEY")!, authorization);
  const { data: userData, error: userError } = await caller.auth.getUser();
  const user = userData?.user;
  if (userError || !user?.email) throw new BusinessError("UNAUTHORIZED", 401);

  const { newPassword, currentPassword } = await parseBody(request);
  if (newPassword.length < MIN_PASSWORD_LENGTH) throw new BusinessError("WEAK_PASSWORD", 400);

  const admin = statelessClient(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("is_active, must_change_password")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error(
      `PROFILE_LOOKUP_FAILED:${profileError.code ?? ""}:${profileError.message ?? ""}`,
    );
  }
  if (!profile || !profile.is_active) throw new BusinessError("FORBIDDEN", 403);

  if (!profile.must_change_password) {
    if (!currentPassword || !(await canSignIn(user.email, currentPassword))) {
      throw new BusinessError("INVALID_CREDENTIALS", 400);
    }
  }

  // Si la clave nueva ya funciona, es igual a la vigente o un reintento tras un fallo parcial
  const isAlreadySet = await canSignIn(user.email, newPassword);
  if (isAlreadySet && !profile.must_change_password) {
    throw new BusinessError("PASSWORD_REUSED", 400);
  }

  if (isAlreadySet) {
    console.info("change-password: new password already active, skipping update");
  } else {
    const { error } = await admin.auth.admin.updateUserById(user.id, { password: newPassword });
    if (error) throw new Error(`PASSWORD_UPDATE_FAILED:${error.status ?? ""}:${error.code ?? ""}`);

    // No se baja la bandera si la clave nueva no quedó vigente
    if (!(await canSignIn(user.email, newPassword))) throw new Error("PASSWORD_NOT_APPLIED");
    console.info("change-password: password updated and verified");
  }

  // Idempotente: si falla, el cliente reintenta y se reanuda desde aquí
  const { error: completeError } = await admin.rpc("complete_password_change", {
    p_user_id: user.id,
  });
  if (completeError) throw new Error("FLAG_UPDATE_FAILED");

  return jsonResponse(200, { ok: true });
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
    // Solo se registra el paso que falló: nunca claves ni tokens
    console.error("change-password failed:", error instanceof Error ? error.message : "unknown");
    return jsonResponse(500, { code: "UNKNOWN", details: {} });
  }
});
