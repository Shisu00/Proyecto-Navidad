-- Corrección de inscripciones (SPECS §5.1, §8.3).
-- Una JJVV corrige sus propias inscripciones; supervisión y administración, las de cualquiera.
-- Se puede corregir mientras la inscripción no esté descartada ni tenga entrega vigente
-- (hay que anular la entrega primero). Siempre exige motivo y deja auditoría.

INSERT INTO public.permissions (code, description) VALUES
  ('inscription.update_any', 'Corregir inscripciones de cualquier JJVV');

UPDATE public.permissions
   SET description = 'Corregir inscripciones propias mientras no estén descartadas ni entregadas'
 WHERE code = 'inscription.update_own';

INSERT INTO public.role_permissions (role_id, permission_code)
SELECT r.id, 'inscription.update_any'
  FROM public.roles r
 WHERE r.code IN ('ADMIN', 'MUNICIPAL_OFFICER');

-- Reevalúa las reglas de calidad tras una corrección:
--  * cierra los casos abiertos que ya no aplican o cuyo detalle cambió
--  * abre los hallazgos nuevos
--  * no reabre un hallazgo idéntico a uno ya resuelto (alguien ya lo aceptó)
CREATE OR REPLACE FUNCTION private.reevaluate_quality_rules(p_inscription_id uuid, p_actor uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_rule record;
  v_details jsonb;
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

    PERFORM private.set_audit_context(p_actor, 'QUALITY_CASE_RESOLVED', 'Corrección de la inscripción');
    UPDATE public.quality_cases qc
       SET status = 'RESOLVED', resolved_at = now(), resolved_by = p_actor
     WHERE qc.inscription_id = p_inscription_id
       AND qc.rule_code = v_rule.code
       AND qc.status = 'OPEN'
       AND (v_details IS NULL OR qc.details IS DISTINCT FROM v_details);

    IF v_details IS NOT NULL AND NOT EXISTS (
      SELECT 1
        FROM public.quality_cases qc
       WHERE qc.inscription_id = p_inscription_id
         AND qc.rule_code = v_rule.code
         AND qc.details = v_details
    ) THEN
      PERFORM private.set_audit_context(p_actor);
      INSERT INTO public.quality_cases (inscription_id, rule_code, related_inscription_id, details)
      VALUES (
        p_inscription_id,
        v_rule.code,
        NULLIF(v_details ->> 'related_inscription_id', '')::uuid,
        v_details
      );
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION private.reevaluate_quality_rules(uuid, uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.update_inscription(
  p_inscription_id uuid,
  p_reason text,
  p_beneficiary_id_type public.id_number_type,
  p_beneficiary_id_number text,
  p_sex public.sex,
  p_birth_date date,
  p_guardian_full_name text,
  p_guardian_id_number text,
  p_guardian_email text DEFAULT NULL,
  p_guardian_phone text DEFAULT NULL,
  p_duplicate_justification text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_can_any boolean;
  v_can_own boolean;
  v_council_id uuid;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_current record;
  v_campaign record;
  v_beneficiary_number text;
  v_guardian_number text;
  v_guardian_name text := btrim(coalesce(p_guardian_full_name, ''));
  v_guardian_email text := nullif(btrim(coalesce(p_guardian_email, '')), '');
  v_guardian_phone text := nullif(btrim(coalesce(p_guardian_phone, '')), '');
  v_justification text := nullif(btrim(coalesce(p_duplicate_justification, '')), '');
  v_new_beneficiary_id uuid;
  v_new_guardian_id uuid;
  v_has_duplicate boolean;
  v_same_council boolean;
  v_identity_changed boolean;
  v_guardian_changed boolean;
  v_open_before integer;
  v_other_open integer;
  v_new_status public.inscription_status;
  v_final_justification text;
BEGIN
  PERFORM private.require_active_user();

  v_can_any := private.has_permission('inscription.update_any');
  v_can_own := private.has_permission('inscription.update_own');
  IF NOT (v_can_any OR v_can_own) THEN
    PERFORM private.raise_business_error(
      'FORBIDDEN',
      jsonb_build_object('permission', 'inscription.update_own')
    );
  END IF;

  v_council_id := private.current_council_id();

  -- Otra JJVV responde NOT_FOUND para no revelar que la inscripción existe
  SELECT i.id, i.status, i.campaign_id, i.beneficiary_id, i.guardian_id, i.sex, i.birth_date,
         i.duplicate_justification,
         b.id_type AS beneficiary_id_type, b.normalized_id_number AS beneficiary_number,
         g.full_name AS guardian_name, g.normalized_id_number AS guardian_number,
         g.email AS guardian_email, g.phone AS guardian_phone
    INTO v_current
    FROM public.inscriptions i
    JOIN public.beneficiaries b ON b.id = i.beneficiary_id
    JOIN public.guardians g ON g.id = i.guardian_id
   WHERE i.id = p_inscription_id
     AND (v_can_any OR i.council_id = v_council_id)
   FOR UPDATE OF i;

  IF NOT FOUND THEN
    PERFORM private.raise_business_error('NOT_FOUND');
  END IF;

  SELECT c.status, c.auto_validate_clean_inscriptions AS auto_validate
    INTO v_campaign
    FROM public.campaigns c
   WHERE c.id = v_current.campaign_id;

  IF v_campaign.status IN ('PLANNED', 'CLOSED') THEN
    PERFORM private.raise_business_error('CAMPAIGN_CLOSED');
  END IF;

  IF v_current.status = 'DISCARDED' THEN
    PERFORM private.raise_business_error(
      'INVALID_STATE_TRANSITION',
      jsonb_build_object('reason', 'DISCARDED')
    );
  END IF;

  -- Con entrega vigente hay que anularla antes de corregir
  IF EXISTS (
    SELECT 1
      FROM public.deliveries d
     WHERE d.inscription_id = v_current.id
       AND d.voided_at IS NULL
  ) THEN
    PERFORM private.raise_business_error(
      'INVALID_STATE_TRANSITION',
      jsonb_build_object('reason', 'ACTIVE_DELIVERY')
    );
  END IF;

  IF v_reason IS NULL OR char_length(v_reason) < 10 THEN
    PERFORM private.raise_business_error('REASON_REQUIRED');
  END IF;

  IF p_beneficiary_id_type IS NULL OR p_sex IS NULL OR p_birth_date IS NULL OR v_guardian_name = '' THEN
    PERFORM private.raise_business_error('VALIDATION_ERROR');
  END IF;

  v_beneficiary_number := private.normalize_id_number(p_beneficiary_id_number);
  IF NOT private.is_valid_id_number(p_beneficiary_id_type, v_beneficiary_number) THEN
    PERFORM private.raise_business_error(
      CASE WHEN p_beneficiary_id_type = 'RUT' THEN 'INVALID_RUT' ELSE 'INVALID_IPE' END,
      jsonb_build_object('field', 'beneficiary_id_number')
    );
  END IF;

  v_guardian_number := private.normalize_id_number(p_guardian_id_number);
  IF NOT private.is_valid_rut(v_guardian_number) THEN
    PERFORM private.raise_business_error(
      'INVALID_RUT',
      jsonb_build_object('field', 'guardian_id_number')
    );
  END IF;

  IF v_justification IS NOT NULL AND char_length(v_justification) < 10 THEN
    PERFORM private.raise_business_error(
      'VALIDATION_ERROR',
      jsonb_build_object('field', 'duplicate_justification', 'reason', 'JUSTIFICATION_TOO_SHORT')
    );
  END IF;

  v_identity_changed := v_current.beneficiary_id_type IS DISTINCT FROM p_beneficiary_id_type
    OR v_current.beneficiary_number IS DISTINCT FROM v_beneficiary_number;
  v_guardian_changed := v_current.guardian_name IS DISTINCT FROM v_guardian_name
    OR v_current.guardian_number IS DISTINCT FROM v_guardian_number
    OR v_current.guardian_email IS DISTINCT FROM v_guardian_email
    OR v_current.guardian_phone IS DISTINCT FROM v_guardian_phone;

  IF NOT v_identity_changed AND NOT v_guardian_changed
     AND v_current.sex = p_sex AND v_current.birth_date = p_birth_date THEN
    PERFORM private.raise_business_error(
      'VALIDATION_ERROR',
      jsonb_build_object('reason', 'NO_CHANGES')
    );
  END IF;

  v_new_beneficiary_id := v_current.beneficiary_id;
  v_final_justification := v_current.duplicate_justification;

  IF v_identity_changed THEN
    -- DO UPDATE no-op para que RETURNING también devuelva el id de uno existente
    INSERT INTO public.beneficiaries (id_type, normalized_id_number)
    VALUES (p_beneficiary_id_type, v_beneficiary_number)
    ON CONFLICT (id_type, normalized_id_number) DO UPDATE SET id_type = EXCLUDED.id_type
    RETURNING id INTO v_new_beneficiary_id;

    -- Serializa con otras inscripciones del mismo niño en la campaña
    PERFORM pg_advisory_xact_lock(hashtext(v_current.campaign_id::text || v_new_beneficiary_id::text));

    SELECT count(*) > 0, coalesce(bool_or(i.council_id IS NOT DISTINCT FROM v_council_id), false)
      INTO v_has_duplicate, v_same_council
      FROM public.inscriptions i
     WHERE i.campaign_id = v_current.campaign_id
       AND i.beneficiary_id = v_new_beneficiary_id
       AND i.id <> v_current.id
       AND i.status <> 'DISCARDED';

    IF v_has_duplicate AND v_justification IS NULL THEN
      PERFORM private.raise_business_error(
        'DUPLICATE_REQUIRES_JUSTIFICATION',
        jsonb_build_object('same_council', v_same_council)
      );
    END IF;

    -- Sin otras inscripciones del niño nuevo, deja de ser un duplicado
    v_final_justification := CASE WHEN v_has_duplicate THEN v_justification END;
  END IF;

  -- El adulto se conserva como historial (SPECS §3.2): una corrección crea un registro nuevo
  v_new_guardian_id := v_current.guardian_id;
  IF v_guardian_changed THEN
    INSERT INTO public.guardians (full_name, normalized_id_number, email, phone)
    VALUES (v_guardian_name, v_guardian_number, v_guardian_email, v_guardian_phone)
    RETURNING id INTO v_new_guardian_id;
  END IF;

  SELECT count(*)::integer
    INTO v_open_before
    FROM public.quality_cases qc
   WHERE qc.inscription_id = v_current.id
     AND qc.status = 'OPEN';

  PERFORM private.set_audit_context(v_user_id, 'INSCRIPTION_CORRECTED', v_reason);
  -- age_at_cutoff y age_range los recalcula el trigger inscriptions_set_age
  UPDATE public.inscriptions
     SET beneficiary_id = v_new_beneficiary_id,
         guardian_id = v_new_guardian_id,
         sex = p_sex,
         birth_date = p_birth_date,
         duplicate_justification = v_final_justification
   WHERE id = v_current.id;

  PERFORM private.reevaluate_quality_rules(v_current.id, v_user_id);

  SELECT count(*) FILTER (WHERE qc.rule_code <> 'Q002')::integer
    INTO v_other_open
    FROM public.quality_cases qc
   WHERE qc.inscription_id = v_current.id
     AND qc.status = 'OPEN';

  -- Una corrección que deja hallazgos manda a revisión; una que los resuelve, valida
  v_new_status := CASE v_current.status
    WHEN 'VALIDATED' THEN
      CASE WHEN v_other_open > 0 THEN 'OBSERVED' ELSE 'VALIDATED' END
    WHEN 'OBSERVED' THEN
      -- Una observación puesta a mano (sin casos abiertos) no se levanta sola
      CASE WHEN v_other_open = 0 AND v_open_before > 0 AND v_campaign.auto_validate
        THEN 'VALIDATED' ELSE 'OBSERVED' END
    ELSE
      CASE WHEN v_other_open > 0 THEN 'OBSERVED'
           WHEN v_campaign.auto_validate THEN 'VALIDATED'
           ELSE 'PENDING' END
  END::public.inscription_status;

  IF v_new_status <> v_current.status THEN
    PERFORM private.set_audit_context(
      v_user_id,
      CASE
        WHEN v_new_status = 'OBSERVED' THEN 'INSCRIPTION_AUTO_OBSERVED'
        WHEN v_final_justification IS NOT NULL THEN 'INSCRIPTION_DUPLICATE_AUTO_VALIDATED'
        ELSE 'INSCRIPTION_AUTO_VALIDATED'
      END,
      v_reason
    );
    UPDATE public.inscriptions SET status = v_new_status WHERE id = v_current.id;
  END IF;

  -- En un duplicado validado la observación es la justificación de la JJVV, no un caso abierto
  IF v_new_status = 'VALIDATED' THEN
    PERFORM private.set_audit_context(
      v_user_id, 'QUALITY_CASE_RESOLVED', 'Duplicado justificado validado automáticamente'
    );
    UPDATE public.quality_cases
       SET status = 'RESOLVED', resolved_at = now(), resolved_by = v_user_id
     WHERE inscription_id = v_current.id
       AND rule_code = 'Q002'
       AND status = 'OPEN';
  END IF;

  RETURN private.inscription_result(v_current.id, false);
END;
$$;

REVOKE ALL ON FUNCTION public.update_inscription(
  uuid, text, public.id_number_type, text, public.sex, date, text, text, text, text, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_inscription(
  uuid, text, public.id_number_type, text, public.sex, date, text, text, text, text, text
) TO authenticated;
