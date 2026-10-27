-- Helpers de autorización y my_permissions() (SPECS §4.2, §4.4).
-- Se consulta profiles → roles → role_permissions en cada petición, de modo
-- que un cambio de permisos rige de inmediato (sin claims en el JWT).
-- SECURITY DEFINER evita la recursión de RLS al leer profiles desde sus políticas.

-- Mientras must_change_password sea true devuelve false: el servidor bloquea
-- todo salvo my_permissions() y la lectura de la propia fila de profiles.
CREATE OR REPLACE FUNCTION private.is_active_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.profiles p
      JOIN public.roles r ON r.id = p.role_id
     WHERE p.id = auth.uid()
       AND p.is_active
       AND NOT p.must_change_password
       AND r.is_active
  );
$$;

CREATE OR REPLACE FUNCTION private.has_permission(p_permission_code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.profiles p
      JOIN public.roles r ON r.id = p.role_id
      JOIN public.role_permissions rp ON rp.role_id = r.id
     WHERE p.id = auth.uid()
       AND p.is_active
       AND NOT p.must_change_password
       AND r.is_active
       AND rp.permission_code = p_permission_code
  );
$$;

-- El alcance territorial siempre sale del perfil, nunca del payload (SPECS §7, inv. 7).
CREATE OR REPLACE FUNCTION private.current_council_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.council_id
    FROM public.profiles p
   WHERE p.id = auth.uid()
     AND p.is_active
     AND NOT p.must_change_password;
$$;

CREATE OR REPLACE FUNCTION private.current_territory_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.territory_id
    FROM public.profiles p
   WHERE p.id = auth.uid()
     AND p.is_active
     AND NOT p.must_change_password;
$$;

REVOKE ALL ON FUNCTION private.is_active_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.has_permission(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.current_council_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.current_territory_id() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION private.is_active_user() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.has_permission(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.current_council_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.current_territory_id() TO authenticated, service_role;

-- Solo para gobernar la UI; la seguridad real vive en RLS y RPC.
-- Funciona aunque must_change_password esté activo.
CREATE OR REPLACE FUNCTION public.my_permissions()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile record;
  v_permissions jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    PERFORM private.raise_business_error('UNAUTHORIZED');
  END IF;

  SELECT p.is_active, p.must_change_password, r.is_active AS role_is_active
    INTO v_profile
    FROM public.profiles p
    JOIN public.roles r ON r.id = p.role_id
   WHERE p.id = v_user_id;

  IF NOT FOUND OR NOT v_profile.is_active OR NOT v_profile.role_is_active THEN
    RETURN jsonb_build_object('permissions', '[]'::jsonb, 'must_change_password', false);
  END IF;

  IF v_profile.must_change_password THEN
    RETURN jsonb_build_object('permissions', '[]'::jsonb, 'must_change_password', true);
  END IF;

  SELECT coalesce(jsonb_agg(rp.permission_code ORDER BY rp.permission_code), '[]'::jsonb)
    INTO v_permissions
    FROM public.profiles p
    JOIN public.role_permissions rp ON rp.role_id = p.role_id
   WHERE p.id = v_user_id;

  RETURN jsonb_build_object('permissions', v_permissions, 'must_change_password', false);
END;
$$;

-- Convención para toda RPC nueva: REVOKE de PUBLIC y anon, GRANT a authenticated.
-- Los privilegios por defecto de Supabase no alcanzan para cerrar anon.
REVOKE ALL ON FUNCTION public.my_permissions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_permissions() TO authenticated;
