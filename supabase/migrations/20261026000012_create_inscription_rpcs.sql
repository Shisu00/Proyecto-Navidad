-- RPC de inscripciones: alta idempotente y revisión municipal (SPECS §5.1, §8.1-§8.3).

CREATE OR REPLACE FUNCTION private.inscription_result(
  p_inscription_id uuid,
  p_idempotent boolean
)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'inscription_id', i.id,
    'status', i.status,
    'is_duplicate', i.duplicate_justification IS NOT NULL,
    'open_cases', (
      SELECT count(*)::integer
        FROM public.quality_cases qc
       WHERE qc.inscription_id = i.id
         AND qc.status = 'OPEN'
    ),
    'idempotent', p_idempotent
  )
    FROM public.inscriptions i
   WHERE i.id = p_inscription_id;
$$;

CREATE OR REPLACE FUNCTION public.submit_inscription(
  p_client_operation_id uuid,
  p_campaign_id uuid,
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
  v_council_id uuid;
  v_territory_id uuid;
  v_existing_id uuid;
  v_campaign record;
  v_beneficiary_number text;
  v_guardian_number text;
  v_justification text;
  v_beneficiary_id uuid;
  v_guardian_id uuid;
  v_inscription_id uuid;
  v_has_duplicate boolean;
  v_same_council boolean;
  v_findings integer;
BEGIN
  PERFORM private.require_permission('inscription.create');

  -- Un reintento devuelve el resultado original, aunque la campaña ya haya cambiado
  SELECT i.id
    INTO v_existing_id
    FROM public.inscriptions i
   WHERE i.created_by = v_user_id
     AND i.client_operation_id = p_client_operation_id;

  IF FOUND THEN
    RETURN private.inscription_result(v_existing_id, true);
  END IF;

  -- El alcance sale del perfil, nunca del payload
  v_council_id := private.current_council_id();
  v_territory_id := private.current_territory_id();
  IF v_council_id IS NULL OR v_territory_id IS NULL THEN
    PERFORM private.raise_business_error(
      'FORBIDDEN',
      jsonb_build_object('reason', 'COUNCIL_REQUIRED')
    );
  END IF;

  SELECT c.status, c.auto_validate_clean_inscriptions AS auto_validate
    INTO v_campaign
    FROM public.campaigns c
   WHERE c.id = p_campaign_id;

  IF NOT FOUND THEN
    PERFORM private.raise_business_error('NOT_FOUND');
  END IF;
  IF v_campaign.status <> 'REGISTRATION_OPEN' THEN
    PERFORM private.raise_business_error('CAMPAIGN_CLOSED');
  END IF;

  IF p_beneficiary_id_type IS NULL
     OR p_sex IS NULL
     OR p_birth_date IS NULL
     OR btrim(coalesce(p_guardian_full_name, '')) = '' THEN
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

  v_justification := nullif(btrim(coalesce(p_duplicate_justification, '')), '');
  IF v_justification IS NOT NULL AND char_length(v_justification) < 10 THEN
    PERFORM private.raise_business_error(
      'VALIDATION_ERROR',
      jsonb_build_object('field', 'duplicate_justification', 'reason', 'JUSTIFICATION_TOO_SHORT')
    );
  END IF;

  -- DO UPDATE no-op para que RETURNING también devuelva el id de uno existente
  INSERT INTO public.beneficiaries (id_type, normalized_id_number)
  VALUES (p_beneficiary_id_type, v_beneficiary_number)
  ON CONFLICT (id_type, normalized_id_number) DO UPDATE SET id_type = EXCLUDED.id_type
  RETURNING id INTO v_beneficiary_id;

  -- Serializa inscripciones del mismo niño en la misma campaña
  PERFORM pg_advisory_xact_lock(hashtext(p_campaign_id::text || v_beneficiary_id::text));

  SELECT count(*) > 0, coalesce(bool_or(i.council_id = v_council_id), false)
    INTO v_has_duplicate, v_same_council
    FROM public.inscriptions i
   WHERE i.campaign_id = p_campaign_id
     AND i.beneficiary_id = v_beneficiary_id
     AND i.status <> 'DISCARDED';

  IF v_has_duplicate AND v_justification IS NULL THEN
    -- No se revela nada de otra JJVV: solo si el duplicado es de la propia
    PERFORM private.raise_business_error(
      'DUPLICATE_REQUIRES_JUSTIFICATION',
      jsonb_build_object('same_council', v_same_council)
    );
  END IF;
  IF NOT v_has_duplicate THEN
    v_justification := NULL;
  END IF;

  INSERT INTO public.guardians (full_name, normalized_id_number, email, phone)
  VALUES (
    btrim(p_guardian_full_name),
    v_guardian_number,
    nullif(btrim(coalesce(p_guardian_email, '')), ''),
    nullif(btrim(coalesce(p_guardian_phone, '')), '')
  )
  RETURNING id INTO v_guardian_id;

  PERFORM private.set_audit_context(
    v_user_id,
    CASE WHEN v_has_duplicate THEN 'INSCRIPTION_DUPLICATE_JUSTIFIED' END,
    v_justification
  );

  -- age_at_cutoff y age_range los calcula el trigger inscriptions_set_age
  INSERT INTO public.inscriptions (
    campaign_id, beneficiary_id, guardian_id, council_id, territory_id, status,
    birth_date, sex, client_operation_id, duplicate_justification, created_by
  )
  VALUES (
    p_campaign_id, v_beneficiary_id, v_guardian_id, v_council_id, v_territory_id,
    CASE WHEN v_has_duplicate THEN 'OBSERVED' ELSE 'PENDING' END::public.inscription_status,
    p_birth_date, p_sex, p_client_operation_id, v_justification, v_user_id
  )
  RETURNING id INTO v_inscription_id;

  v_findings := private.run_quality_rules(v_inscription_id, v_user_id);

  -- Un duplicado justificado nace OBSERVED y no altera a la inscripción original
  IF NOT v_has_duplicate THEN
    IF v_findings > 0 THEN
      PERFORM private.set_audit_context(v_user_id, 'INSCRIPTION_AUTO_OBSERVED');
      UPDATE public.inscriptions SET status = 'OBSERVED' WHERE id = v_inscription_id;
    ELSIF v_campaign.auto_validate THEN
      PERFORM private.set_audit_context(v_user_id, 'INSCRIPTION_AUTO_VALIDATED');
      UPDATE public.inscriptions SET status = 'VALIDATED' WHERE id = v_inscription_id;
    END IF;
  END IF;

  RETURN private.inscription_result(v_inscription_id, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_inscription(
  p_inscription_id uuid,
  p_action text,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_inscription record;
  v_campaign_status public.campaign_status;
  v_target public.inscription_status;
  v_audit_action text;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
BEGIN
  PERFORM private.require_permission('inscription.review');

  SELECT i.id, i.status, i.campaign_id
    INTO v_inscription
    FROM public.inscriptions i
   WHERE i.id = p_inscription_id
   FOR UPDATE;

  IF NOT FOUND THEN
    PERFORM private.raise_business_error('NOT_FOUND');
  END IF;

  SELECT c.status INTO v_campaign_status
    FROM public.campaigns c
   WHERE c.id = v_inscription.campaign_id;

  IF v_campaign_status IN ('PLANNED', 'CLOSED') THEN
    PERFORM private.raise_business_error('CAMPAIGN_CLOSED');
  END IF;

  CASE upper(coalesce(p_action, ''))
    WHEN 'VALIDATE' THEN
      v_target := 'VALIDATED';
      v_audit_action := 'INSCRIPTION_VALIDATED';
    WHEN 'OBSERVE' THEN
      v_target := 'OBSERVED';
      v_audit_action := 'INSCRIPTION_OBSERVED';
    WHEN 'DISCARD' THEN
      v_target := 'DISCARDED';
      v_audit_action := 'INSCRIPTION_DISCARDED';
    ELSE
      PERFORM private.raise_business_error(
        'VALIDATION_ERROR',
        jsonb_build_object('field', 'action')
      );
  END CASE;

  IF NOT (
    (v_inscription.status = 'PENDING' AND v_target IN ('VALIDATED', 'OBSERVED', 'DISCARDED'))
    OR (v_inscription.status = 'OBSERVED' AND v_target IN ('VALIDATED', 'DISCARDED'))
    OR (v_inscription.status = 'VALIDATED' AND v_target IN ('OBSERVED', 'DISCARDED'))
  ) THEN
    PERFORM private.raise_business_error(
      'INVALID_STATE_TRANSITION',
      jsonb_build_object('from', v_inscription.status, 'to', v_target)
    );
  END IF;

  IF v_reason IS NULL AND NOT (v_inscription.status = 'PENDING' AND v_target = 'VALIDATED') THEN
    PERFORM private.raise_business_error('REASON_REQUIRED');
  END IF;

  -- Con entrega vigente hay que anularla antes de observar o descartar
  IF v_target IN ('OBSERVED', 'DISCARDED') AND EXISTS (
    SELECT 1
      FROM public.deliveries d
     WHERE d.inscription_id = v_inscription.id
       AND d.voided_at IS NULL
  ) THEN
    PERFORM private.raise_business_error(
      'INVALID_STATE_TRANSITION',
      jsonb_build_object('reason', 'ACTIVE_DELIVERY')
    );
  END IF;

  PERFORM private.set_audit_context(v_user_id, v_audit_action, v_reason);
  UPDATE public.inscriptions SET status = v_target WHERE id = v_inscription.id;

  IF v_target IN ('VALIDATED', 'DISCARDED') THEN
    PERFORM private.set_audit_context(v_user_id, 'QUALITY_CASE_RESOLVED', v_reason);
    UPDATE public.quality_cases
       SET status = 'RESOLVED', resolved_at = now(), resolved_by = v_user_id
     WHERE inscription_id = v_inscription.id
       AND status = 'OPEN';
  END IF;

  RETURN private.inscription_result(v_inscription.id, false);
END;
$$;

REVOKE ALL ON FUNCTION public.submit_inscription(
  uuid, uuid, public.id_number_type, text, public.sex, date, text, text, text, text, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_inscription(
  uuid, uuid, public.id_number_type, text, public.sex, date, text, text, text, text, text
) TO authenticated;

REVOKE ALL ON FUNCTION public.resolve_inscription(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_inscription(uuid, text, text) TO authenticated;
