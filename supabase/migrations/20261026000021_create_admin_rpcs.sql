-- Administración: cuentas, catálogos y roles (SPECS §5.1, §9).
-- Convención: guarda de permiso al inicio, REVOKE de PUBLIC y anon, GRANT a authenticated.
-- Los datos se escriben solo aquí: profiles, catálogos y roles no admiten escritura directa.

-- Anti-escalación (SPECS §4.5): quien gestiona roles administra cualquier cuenta;
-- quien solo gestiona usuarios únicamente toca cuentas de roles territoriales.
CREATE OR REPLACE FUNCTION private.can_manage_role(p_role_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.roles r
     WHERE r.id = p_role_id
       AND (
         private.has_permission('role.manage')
         OR (private.has_permission('user.manage') AND r.requires_council)
       )
  );
$$;

REVOKE ALL ON FUNCTION private.can_manage_role(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.can_manage_role(uuid) TO authenticated, service_role;

-- La usa admin-credentials para validar antes de crear la cuenta en Auth
CREATE OR REPLACE FUNCTION public.admin_can_manage_role(p_role_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM private.require_permission('user.manage');
  RETURN private.can_manage_role(p_role_id);
END;
$$;

-- El correo vive en auth.users, que el cliente no puede leer
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (
  id uuid,
  email text,
  full_name text,
  role_id uuid,
  role_code text,
  role_name text,
  territory_id uuid,
  council_id uuid,
  is_active boolean,
  must_change_password boolean,
  created_at timestamptz,
  last_sign_in_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM private.require_permission('user.read');

  RETURN QUERY
  SELECT p.id, u.email::text, p.full_name, p.role_id, r.code, r.name,
         p.territory_id, p.council_id, p.is_active, p.must_change_password,
         p.created_at, u.last_sign_in_at
    FROM public.profiles p
    JOIN public.roles r ON r.id = p.role_id
    JOIN auth.users u ON u.id = p.id
   ORDER BY p.full_name, p.created_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_create_profile(
  p_user_id uuid,
  p_full_name text,
  p_role_id uuid,
  p_territory_id uuid DEFAULT NULL,
  p_council_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_name text := btrim(coalesce(p_full_name, ''));
  v_role record;
  v_council record;
  v_territory_id uuid := p_territory_id;
BEGIN
  PERFORM private.require_permission('user.manage');

  IF p_user_id IS NULL OR v_name = '' OR p_role_id IS NULL THEN
    PERFORM private.raise_business_error('VALIDATION_ERROR');
  END IF;

  SELECT r.is_active, r.requires_council
    INTO v_role
    FROM public.roles r
   WHERE r.id = p_role_id;

  IF NOT FOUND OR NOT v_role.is_active THEN
    PERFORM private.raise_business_error(
      'VALIDATION_ERROR',
      jsonb_build_object('field', 'role_id', 'reason', 'ROLE_NOT_AVAILABLE')
    );
  END IF;

  IF NOT private.can_manage_role(p_role_id) THEN
    PERFORM private.raise_business_error(
      'FORBIDDEN',
      jsonb_build_object('reason', 'ROLE_NOT_ASSIGNABLE')
    );
  END IF;

  IF p_council_id IS NOT NULL THEN
    SELECT nc.territory_id, nc.is_active, t.is_active AS territory_is_active
      INTO v_council
      FROM public.neighborhood_councils nc
      JOIN public.territories t ON t.id = nc.territory_id
     WHERE nc.id = p_council_id;

    IF NOT FOUND OR NOT v_council.is_active OR NOT v_council.territory_is_active THEN
      PERFORM private.raise_business_error(
        'VALIDATION_ERROR',
        jsonb_build_object('field', 'council_id', 'reason', 'COUNCIL_NOT_AVAILABLE')
      );
    END IF;
    IF p_territory_id IS NOT NULL AND p_territory_id <> v_council.territory_id THEN
      PERFORM private.raise_business_error(
        'VALIDATION_ERROR',
        jsonb_build_object('field', 'council_id', 'reason', 'COUNCIL_NOT_AVAILABLE')
      );
    END IF;
    v_territory_id := v_council.territory_id;
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = p_user_id) THEN
    PERFORM private.raise_business_error(
      'VALIDATION_ERROR',
      jsonb_build_object('field', 'user_id', 'reason', 'PROFILE_EXISTS')
    );
  END IF;

  PERFORM private.set_audit_context(auth.uid(), 'USER_CREATED');

  -- validate_profile_scope exige territorio y JJVV si el rol los requiere
  INSERT INTO public.profiles (
    id, full_name, role_id, territory_id, council_id, must_change_password, created_by
  )
  VALUES (p_user_id, v_name, p_role_id, v_territory_id, p_council_id, true, auth.uid());

  RETURN jsonb_build_object('user_id', p_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_profile_active(
  p_user_id uuid,
  p_active boolean,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_target record;
BEGIN
  PERFORM private.require_permission('user.manage');

  IF p_user_id IS NULL OR p_active IS NULL THEN
    PERFORM private.raise_business_error('VALIDATION_ERROR');
  END IF;

  IF NOT p_active AND p_user_id = auth.uid() THEN
    PERFORM private.raise_business_error('SELF_DEACTIVATION_NOT_ALLOWED');
  END IF;

  SELECT p.role_id, p.is_active
    INTO v_target
    FROM public.profiles p
   WHERE p.id = p_user_id
   FOR UPDATE;

  IF NOT FOUND THEN
    PERFORM private.raise_business_error('NOT_FOUND');
  END IF;

  IF NOT private.can_manage_role(v_target.role_id) THEN
    PERFORM private.raise_business_error(
      'FORBIDDEN',
      jsonb_build_object('reason', 'ROLE_NOT_ASSIGNABLE')
    );
  END IF;

  IF v_reason IS NULL OR char_length(v_reason) < 10 THEN
    PERFORM private.raise_business_error('REASON_REQUIRED');
  END IF;

  IF v_target.is_active IS DISTINCT FROM p_active THEN
    PERFORM private.set_audit_context(
      auth.uid(),
      CASE WHEN p_active THEN 'USER_REACTIVATED' ELSE 'USER_DEACTIVATED' END,
      v_reason
    );
    UPDATE public.profiles SET is_active = p_active WHERE id = p_user_id;
  END IF;

  RETURN jsonb_build_object('user_id', p_user_id, 'is_active', p_active);
END;
$$;

-- Primer paso de reset_password: autoriza, sube la bandera y deja auditoría.
-- La bandera sube antes de cambiar la clave: si el cambio falla, la cuenta
-- solo queda obligada a cambiar su clave actual, nunca con una clave temporal sin bandera.
CREATE OR REPLACE FUNCTION public.admin_mark_password_reset(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_target record;
BEGIN
  PERFORM private.require_permission('user.manage');

  SELECT p.role_id, p.is_active
    INTO v_target
    FROM public.profiles p
   WHERE p.id = p_user_id
   FOR UPDATE;

  IF NOT FOUND THEN
    PERFORM private.raise_business_error('NOT_FOUND');
  END IF;

  IF NOT private.can_manage_role(v_target.role_id) THEN
    PERFORM private.raise_business_error(
      'FORBIDDEN',
      jsonb_build_object('reason', 'ROLE_NOT_ASSIGNABLE')
    );
  END IF;

  IF NOT v_target.is_active THEN
    PERFORM private.raise_business_error(
      'FORBIDDEN',
      jsonb_build_object('reason', 'ACCOUNT_INACTIVE')
    );
  END IF;

  PERFORM private.set_audit_context(auth.uid(), 'PASSWORD_RESET_ISSUED');
  UPDATE public.profiles SET must_change_password = true WHERE id = p_user_id;

  RETURN jsonb_build_object('user_id', p_user_id);
END;
$$;

-- ---------------------------------------------------------------- catálogos

CREATE OR REPLACE FUNCTION public.admin_upsert_territory(
  p_name text,
  p_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_name text := btrim(coalesce(p_name, ''));
  v_id uuid;
BEGIN
  PERFORM private.require_permission('catalog.manage');

  IF v_name = '' THEN
    PERFORM private.raise_business_error(
      'VALIDATION_ERROR',
      jsonb_build_object('field', 'name', 'reason', 'REQUIRED')
    );
  END IF;

  PERFORM private.set_audit_context(auth.uid(), 'CATALOG_CHANGED');

  BEGIN
    IF p_id IS NULL THEN
      INSERT INTO public.territories (name) VALUES (v_name) RETURNING id INTO v_id;
    ELSE
      UPDATE public.territories SET name = v_name WHERE id = p_id RETURNING id INTO v_id;
    END IF;
  EXCEPTION
    WHEN unique_violation THEN
      PERFORM private.raise_business_error(
        'VALIDATION_ERROR',
        jsonb_build_object('field', 'name', 'reason', 'NAME_TAKEN')
      );
  END;

  IF v_id IS NULL THEN
    PERFORM private.raise_business_error('NOT_FOUND');
  END IF;
  RETURN v_id;
END;
$$;

-- El territorio de una JJVV existente no cambia: sus inscripciones lo referencian
CREATE OR REPLACE FUNCTION public.admin_upsert_council(
  p_territory_id uuid,
  p_name text,
  p_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_name text := btrim(coalesce(p_name, ''));
  v_id uuid;
  v_current_territory uuid;
BEGIN
  PERFORM private.require_permission('catalog.manage');

  IF v_name = '' THEN
    PERFORM private.raise_business_error(
      'VALIDATION_ERROR',
      jsonb_build_object('field', 'name', 'reason', 'REQUIRED')
    );
  END IF;

  PERFORM private.set_audit_context(auth.uid(), 'CATALOG_CHANGED');

  BEGIN
    IF p_id IS NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.territories t WHERE t.id = p_territory_id AND t.is_active
      ) THEN
        PERFORM private.raise_business_error(
          'VALIDATION_ERROR',
          jsonb_build_object('field', 'territory_id', 'reason', 'TERRITORY_NOT_AVAILABLE')
        );
      END IF;
      INSERT INTO public.neighborhood_councils (territory_id, name)
      VALUES (p_territory_id, v_name)
      RETURNING id INTO v_id;
    ELSE
      SELECT nc.territory_id INTO v_current_territory
        FROM public.neighborhood_councils nc WHERE nc.id = p_id FOR UPDATE;
      IF NOT FOUND THEN
        PERFORM private.raise_business_error('NOT_FOUND');
      END IF;
      IF p_territory_id IS DISTINCT FROM v_current_territory THEN
        PERFORM private.raise_business_error(
          'VALIDATION_ERROR',
          jsonb_build_object('field', 'territory_id', 'reason', 'TERRITORY_IMMUTABLE')
        );
      END IF;
      UPDATE public.neighborhood_councils SET name = v_name WHERE id = p_id RETURNING id INTO v_id;
    END IF;
  EXCEPTION
    WHEN unique_violation THEN
      PERFORM private.raise_business_error(
        'VALIDATION_ERROR',
        jsonb_build_object('field', 'name', 'reason', 'NAME_TAKEN')
      );
  END;

  RETURN v_id;
END;
$$;

-- Año y fecha de corte fijan la edad de cada inscripción: no cambian si ya hay inscritos
CREATE OR REPLACE FUNCTION public.admin_upsert_campaign(
  p_year integer,
  p_name text,
  p_age_cutoff_date date,
  p_auto_validate boolean DEFAULT true,
  p_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_name text := btrim(coalesce(p_name, ''));
  v_id uuid;
  v_current record;
BEGIN
  PERFORM private.require_permission('catalog.manage');

  IF v_name = '' OR p_year IS NULL OR p_age_cutoff_date IS NULL THEN
    PERFORM private.raise_business_error('VALIDATION_ERROR');
  END IF;
  IF p_year NOT BETWEEN 2000 AND 2100 THEN
    PERFORM private.raise_business_error(
      'VALIDATION_ERROR',
      jsonb_build_object('field', 'year', 'reason', 'YEAR_OUT_OF_RANGE')
    );
  END IF;

  PERFORM private.set_audit_context(auth.uid(), 'CATALOG_CHANGED');

  BEGIN
    IF p_id IS NULL THEN
      INSERT INTO public.campaigns (year, name, age_cutoff_date, auto_validate_clean_inscriptions)
      VALUES (p_year, v_name, p_age_cutoff_date, coalesce(p_auto_validate, true))
      RETURNING id INTO v_id;
    ELSE
      SELECT c.year, c.age_cutoff_date, c.status
        INTO v_current
        FROM public.campaigns c WHERE c.id = p_id FOR UPDATE;
      IF NOT FOUND THEN
        PERFORM private.raise_business_error('NOT_FOUND');
      END IF;
      IF v_current.status = 'CLOSED' THEN
        PERFORM private.raise_business_error('CAMPAIGN_CLOSED');
      END IF;
      IF (v_current.year <> p_year OR v_current.age_cutoff_date <> p_age_cutoff_date)
         AND EXISTS (SELECT 1 FROM public.inscriptions i WHERE i.campaign_id = p_id) THEN
        PERFORM private.raise_business_error(
          'VALIDATION_ERROR',
          jsonb_build_object('field', 'age_cutoff_date', 'reason', 'CAMPAIGN_HAS_INSCRIPTIONS')
        );
      END IF;
      UPDATE public.campaigns
         SET year = p_year, name = v_name, age_cutoff_date = p_age_cutoff_date,
             auto_validate_clean_inscriptions = coalesce(p_auto_validate, true)
       WHERE id = p_id
       RETURNING id INTO v_id;
    END IF;
  EXCEPTION
    WHEN unique_violation THEN
      PERFORM private.raise_business_error(
        'VALIDATION_ERROR',
        jsonb_build_object('field', 'year', 'reason', 'YEAR_TAKEN')
      );
  END;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_catalog_active(
  p_entity text,
  p_id uuid,
  p_active boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count integer;
BEGIN
  PERFORM private.require_permission('catalog.manage');

  IF p_id IS NULL OR p_active IS NULL OR p_entity NOT IN ('TERRITORY', 'COUNCIL') THEN
    PERFORM private.raise_business_error('VALIDATION_ERROR');
  END IF;

  PERFORM private.set_audit_context(auth.uid(), 'CATALOG_CHANGED');

  IF p_entity = 'TERRITORY' THEN
    UPDATE public.territories SET is_active = p_active WHERE id = p_id;
  ELSE
    UPDATE public.neighborhood_councils SET is_active = p_active WHERE id = p_id;
  END IF;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count = 0 THEN
    PERFORM private.raise_business_error('NOT_FOUND');
  END IF;

  RETURN jsonb_build_object('id', p_id, 'is_active', p_active);
END;
$$;

-- -------------------------------------------------------------------- roles

CREATE OR REPLACE FUNCTION public.admin_upsert_role(
  p_code text,
  p_name text,
  p_requires_council boolean DEFAULT false,
  p_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_name text := btrim(coalesce(p_name, ''));
  v_id uuid;
  v_role record;
BEGIN
  PERFORM private.require_permission('role.manage');

  IF v_name = '' OR (p_id IS NULL AND v_code = '') THEN
    PERFORM private.raise_business_error('VALIDATION_ERROR');
  END IF;

  PERFORM private.set_audit_context(auth.uid(), 'ROLE_CHANGED');

  BEGIN
    IF p_id IS NULL THEN
      IF v_code !~ '^[A-Z][A-Z0-9_]*$' THEN
        PERFORM private.raise_business_error(
          'VALIDATION_ERROR',
          jsonb_build_object('field', 'code', 'reason', 'INVALID_CODE')
        );
      END IF;
      INSERT INTO public.roles (code, name, requires_council, is_system)
      VALUES (v_code, v_name, coalesce(p_requires_council, false), false)
      RETURNING id INTO v_id;
    ELSE
      SELECT r.is_system, r.requires_council
        INTO v_role
        FROM public.roles r WHERE r.id = p_id FOR UPDATE;
      IF NOT FOUND THEN
        PERFORM private.raise_business_error('NOT_FOUND');
      END IF;
      IF v_role.is_system THEN
        PERFORM private.raise_business_error('ROLE_SYSTEM_IMMUTABLE');
      END IF;
      IF v_role.requires_council IS DISTINCT FROM coalesce(p_requires_council, false)
         AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.role_id = p_id) THEN
        PERFORM private.raise_business_error('ROLE_IN_USE');
      END IF;
      UPDATE public.roles
         SET name = v_name, requires_council = coalesce(p_requires_council, false)
       WHERE id = p_id
       RETURNING id INTO v_id;
    END IF;
  EXCEPTION
    WHEN unique_violation THEN
      PERFORM private.raise_business_error(
        'VALIDATION_ERROR',
        jsonb_build_object('field', 'code', 'reason', 'CODE_TAKEN')
      );
  END;

  RETURN v_id;
END;
$$;

-- Reemplaza el conjunto completo de permisos del rol
CREATE OR REPLACE FUNCTION public.admin_set_role_permissions(
  p_role_id uuid,
  p_permission_codes text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role record;
  v_codes text[] := coalesce(p_permission_codes, '{}');
  v_unknown text[];
BEGIN
  PERFORM private.require_permission('role.manage');

  SELECT r.is_system INTO v_role FROM public.roles r WHERE r.id = p_role_id FOR UPDATE;
  IF NOT FOUND THEN
    PERFORM private.raise_business_error('NOT_FOUND');
  END IF;
  IF v_role.is_system THEN
    PERFORM private.raise_business_error('ROLE_SYSTEM_IMMUTABLE');
  END IF;

  SELECT array_agg(c)
    INTO v_unknown
    FROM unnest(v_codes) AS c
   WHERE NOT EXISTS (SELECT 1 FROM public.permissions p WHERE p.code = c);

  IF v_unknown IS NOT NULL THEN
    PERFORM private.raise_business_error(
      'VALIDATION_ERROR',
      jsonb_build_object('field', 'permission_codes', 'unknown', to_jsonb(v_unknown))
    );
  END IF;

  PERFORM private.set_audit_context(auth.uid(), 'ROLE_PERMISSIONS_CHANGED');

  DELETE FROM public.role_permissions rp
   WHERE rp.role_id = p_role_id
     AND rp.permission_code <> ALL (v_codes);

  INSERT INTO public.role_permissions (role_id, permission_code)
  SELECT p_role_id, c FROM (SELECT DISTINCT unnest(v_codes) AS c) codes
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object('role_id', p_role_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_role_active(
  p_role_id uuid,
  p_active boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role record;
BEGIN
  PERFORM private.require_permission('role.manage');

  IF p_active IS NULL THEN
    PERFORM private.raise_business_error('VALIDATION_ERROR');
  END IF;

  SELECT r.is_system INTO v_role FROM public.roles r WHERE r.id = p_role_id FOR UPDATE;
  IF NOT FOUND THEN
    PERFORM private.raise_business_error('NOT_FOUND');
  END IF;
  IF v_role.is_system THEN
    PERFORM private.raise_business_error('ROLE_SYSTEM_IMMUTABLE');
  END IF;

  IF NOT p_active AND EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.role_id = p_role_id AND p.is_active
  ) THEN
    PERFORM private.raise_business_error('ROLE_IN_USE');
  END IF;

  PERFORM private.set_audit_context(auth.uid(), 'ROLE_CHANGED');
  UPDATE public.roles SET is_active = p_active WHERE id = p_role_id;

  RETURN jsonb_build_object('role_id', p_role_id, 'is_active', p_active);
END;
$$;

-- ------------------------------------------------------------------- grants

REVOKE ALL ON FUNCTION public.admin_can_manage_role(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_list_users() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_create_profile(uuid, text, uuid, uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_profile_active(uuid, boolean, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_mark_password_reset(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_upsert_territory(text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_upsert_council(uuid, text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_upsert_campaign(integer, text, date, boolean, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_catalog_active(text, uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_upsert_role(text, text, boolean, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_role_permissions(uuid, text[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_role_active(uuid, boolean) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.admin_can_manage_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_profile(uuid, text, uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_profile_active(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_mark_password_reset(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_upsert_territory(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_upsert_council(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_upsert_campaign(integer, text, date, boolean, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_catalog_active(text, uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_upsert_role(text, text, boolean, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_role_permissions(uuid, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_role_active(uuid, boolean) TO authenticated;
