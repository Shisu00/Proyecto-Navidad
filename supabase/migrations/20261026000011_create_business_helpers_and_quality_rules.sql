-- Guardas de permiso, evaluadores del motor de calidad y su ejecución (SPECS §6).

-- Distingue clave temporal pendiente de falta de permiso (SPECS §4.2)
CREATE OR REPLACE FUNCTION private.require_active_user()
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_must_change boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    PERFORM private.raise_business_error('UNAUTHORIZED');
  END IF;

  SELECT p.must_change_password
    INTO v_must_change
    FROM public.profiles p
   WHERE p.id = auth.uid();

  IF v_must_change THEN
    PERFORM private.raise_business_error('PASSWORD_CHANGE_REQUIRED');
  END IF;

  IF NOT private.is_active_user() THEN
    PERFORM private.raise_business_error('FORBIDDEN');
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION private.require_permission(p_permission_code text)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM private.require_active_user();

  IF NOT private.has_permission(p_permission_code) THEN
    PERFORM private.raise_business_error(
      'FORBIDDEN',
      jsonb_build_object('permission', p_permission_code)
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION private.require_active_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.require_permission(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.require_active_user() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.require_permission(text) TO authenticated, service_role;

-- Evaluadores: devuelven NULL sin hallazgo o un jsonb con el detalle del caso.
CREATE OR REPLACE FUNCTION private.eval_q001(p_inscription_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT jsonb_build_object('reason', 'INVALID_IDENTIFICATION')
    FROM public.inscriptions i
    JOIN public.beneficiaries b ON b.id = i.beneficiary_id
    JOIN public.guardians g ON g.id = i.guardian_id
   WHERE i.id = p_inscription_id
     AND (
       NOT private.is_valid_id_number(b.id_type, b.normalized_id_number)
       OR NOT private.is_valid_rut(g.normalized_id_number)
     );
$$;

-- Solo aplica a duplicados justificados; la original queda como relacionada
CREATE OR REPLACE FUNCTION private.eval_q002(p_inscription_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT jsonb_build_object('related_inscription_id', o.id)
    FROM public.inscriptions i
    JOIN LATERAL (
      SELECT x.id
        FROM public.inscriptions x
       WHERE x.campaign_id = i.campaign_id
         AND x.beneficiary_id = i.beneficiary_id
         AND x.id <> i.id
         AND x.status <> 'DISCARDED'
       ORDER BY x.created_at
       LIMIT 1
    ) o ON true
   WHERE i.id = p_inscription_id
     AND i.duplicate_justification IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION private.eval_q003(p_inscription_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT jsonb_build_object('age_at_cutoff', i.age_at_cutoff)
    FROM public.inscriptions i
   WHERE i.id = p_inscription_id
     AND i.age_range IS NULL;
$$;

CREATE OR REPLACE FUNCTION private.eval_q005(p_inscription_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT jsonb_build_object('reason', 'REQUIRED_FIELD_EMPTY')
    FROM public.inscriptions i
    JOIN public.guardians g ON g.id = i.guardian_id
   WHERE i.id = p_inscription_id
     AND (btrim(g.full_name) = '' OR btrim(g.normalized_id_number) = '');
$$;

-- Inconsistencia detectable sin consultar otras fuentes: el adulto comparte RUT con el niño
CREATE OR REPLACE FUNCTION private.eval_q006(p_inscription_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT jsonb_build_object('reason', 'GUARDIAN_SAME_ID_AS_CHILD')
    FROM public.inscriptions i
    JOIN public.beneficiaries b ON b.id = i.beneficiary_id
    JOIN public.guardians g ON g.id = i.guardian_id
   WHERE i.id = p_inscription_id
     AND b.id_type = 'RUT'
     AND b.normalized_id_number = g.normalized_id_number;
$$;

INSERT INTO public.quality_rules (code, name, description, severity, evaluator_function) VALUES
  ('Q001', 'Identificación inválida', 'RUT o IPE con formato o dígito verificador inválido', 'HIGH', 'eval_q001'),
  ('Q002', 'Niño ya inscrito', 'Duplicado justificado dentro de la campaña', 'MEDIUM', 'eval_q002'),
  ('Q003', 'Edad fuera de rango', 'Edad a la fecha de corte fuera de 0 a 10 años', 'MEDIUM', 'eval_q003'),
  ('Q005', 'Dato obligatorio vacío', 'Falta un dato obligatorio de la inscripción', 'HIGH', 'eval_q005'),
  ('Q006', 'Datos inconsistentes', 'Datos que se contradicen entre sí', 'LOW', 'eval_q006');

-- Ejecuta las reglas activas y abre un caso por hallazgo. Devuelve cuántos hubo.
CREATE OR REPLACE FUNCTION private.run_quality_rules(p_inscription_id uuid, p_actor uuid)
RETURNS integer
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_rule record;
  v_details jsonb;
  v_count integer := 0;
BEGIN
  FOR v_rule IN
    SELECT qr.code, qr.evaluator_function
      FROM public.quality_rules qr
     WHERE qr.is_active
     ORDER BY qr.code
  LOOP
    EXECUTE format('SELECT private.%I($1)', v_rule.evaluator_function)
      INTO v_details
      USING p_inscription_id;

    IF v_details IS NOT NULL THEN
      -- El contexto de auditoría es por transacción: se restablece antes de cada escritura
      PERFORM private.set_audit_context(p_actor);

      INSERT INTO public.quality_cases (inscription_id, rule_code, related_inscription_id, details)
      VALUES (
        p_inscription_id,
        v_rule.code,
        NULLIF(v_details ->> 'related_inscription_id', '')::uuid,
        v_details
      )
      ON CONFLICT DO NOTHING;

      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION private.run_quality_rules(uuid, uuid) FROM PUBLIC;
