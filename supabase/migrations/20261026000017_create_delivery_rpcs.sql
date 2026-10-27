-- RPC de entrega y anulación (SPECS §5.1, §8.4, §8.5).

CREATE OR REPLACE FUNCTION public.confirm_delivery(
  p_inscription_id uuid,
  p_withdrawal_type public.withdrawal_type,
  p_withdrawer_id_number text DEFAULT NULL,
  p_observation text DEFAULT NULL,
  p_responsibility_confirmed boolean DEFAULT false,
  p_scanned boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_council_id uuid;
  v_inscription record;
  v_campaign_status public.campaign_status;
  v_existing record;
  v_guardian_number text;
  v_withdrawer text := nullif(private.normalize_id_number(p_withdrawer_id_number), '');
  v_observation text := nullif(btrim(coalesce(p_observation, '')), '');
  v_delivery_id uuid;
  v_delivered_at timestamptz;
BEGIN
  PERFORM private.require_permission('delivery.confirm');

  -- El alcance sale del perfil, nunca del payload
  v_council_id := private.current_council_id();
  IF v_council_id IS NULL THEN
    PERFORM private.raise_business_error(
      'FORBIDDEN',
      jsonb_build_object('reason', 'COUNCIL_REQUIRED')
    );
  END IF;

  IF p_withdrawal_type IS NULL THEN
    PERFORM private.raise_business_error('VALIDATION_ERROR');
  END IF;

  -- Otra JJVV responde NOT_FOUND para no revelar que la inscripción existe
  SELECT i.id, i.status, i.campaign_id, i.council_id, i.territory_id, i.guardian_id
    INTO v_inscription
    FROM public.inscriptions i
   WHERE i.id = p_inscription_id
     AND i.council_id = v_council_id
   FOR UPDATE;

  IF NOT FOUND THEN
    PERFORM private.raise_business_error('NOT_FOUND');
  END IF;

  SELECT c.status INTO v_campaign_status
    FROM public.campaigns c
   WHERE c.id = v_inscription.campaign_id;

  IF v_campaign_status <> 'DELIVERY' THEN
    PERFORM private.raise_business_error('CAMPAIGN_NOT_IN_DELIVERY');
  END IF;

  IF v_inscription.status <> 'VALIDATED' THEN
    PERFORM private.raise_business_error('INSCRIPTION_NOT_VALIDATED');
  END IF;

  SELECT d.id, d.delivered_at
    INTO v_existing
    FROM public.deliveries d
   WHERE d.inscription_id = v_inscription.id
     AND d.voided_at IS NULL;

  IF FOUND THEN
    PERFORM private.raise_business_error(
      'DELIVERY_ALREADY_COMPLETED',
      jsonb_build_object('delivery_id', v_existing.id, 'delivered_at', v_existing.delivered_at)
    );
  END IF;

  IF v_withdrawer IS NOT NULL AND NOT private.is_valid_rut(v_withdrawer) THEN
    PERFORM private.raise_business_error(
      'INVALID_RUT',
      jsonb_build_object('field', 'withdrawer_id_number')
    );
  END IF;

  IF p_withdrawal_type = 'STANDARD' THEN
    IF v_withdrawer IS NULL THEN
      PERFORM private.raise_business_error(
        'VALIDATION_ERROR',
        jsonb_build_object('field', 'withdrawer_id_number', 'reason', 'REQUIRED')
      );
    END IF;

    SELECT g.normalized_id_number INTO v_guardian_number
      FROM public.guardians g
     WHERE g.id = v_inscription.guardian_id;

    IF v_withdrawer <> v_guardian_number THEN
      PERFORM private.raise_business_error('WITHDRAWER_MISMATCH');
    END IF;
  ELSE
    IF v_observation IS NULL OR char_length(v_observation) < 10 THEN
      PERFORM private.raise_business_error('OBSERVATION_REQUIRED');
    END IF;
    IF NOT coalesce(p_responsibility_confirmed, false) THEN
      PERFORM private.raise_business_error('RESPONSIBILITY_NOT_CONFIRMED');
    END IF;
  END IF;

  PERFORM private.set_audit_context(
    v_user_id,
    'DELIVERY_CONFIRMED',
    p_withdrawal_type::text || coalesce(': ' || v_observation, '')
  );

  BEGIN
    INSERT INTO public.deliveries (
      inscription_id, campaign_id, council_id, territory_id, delivered_by_user_id,
      withdrawal_type, withdrawer_id_number, observation,
      responsibility_confirmed, scanned_from_id_card
    )
    VALUES (
      v_inscription.id, v_inscription.campaign_id, v_inscription.council_id,
      v_inscription.territory_id, v_user_id,
      p_withdrawal_type, v_withdrawer, v_observation,
      coalesce(p_responsibility_confirmed, false),
      coalesce(p_scanned, false) AND v_withdrawer IS NOT NULL
    )
    RETURNING id, delivered_at INTO v_delivery_id, v_delivered_at;
  EXCEPTION
    -- Respaldo del índice parcial si dos registros llegaran a competir
    WHEN unique_violation THEN
      PERFORM private.raise_business_error('DELIVERY_ALREADY_COMPLETED');
  END;

  RETURN jsonb_build_object('delivery_id', v_delivery_id, 'delivered_at', v_delivered_at);
END;
$$;

CREATE OR REPLACE FUNCTION public.void_delivery(
  p_delivery_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_council_id uuid;
  v_delivery record;
  v_campaign_status public.campaign_status;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
BEGIN
  PERFORM private.require_permission('delivery.void');

  v_council_id := private.current_council_id();
  IF v_council_id IS NULL THEN
    PERFORM private.raise_business_error(
      'FORBIDDEN',
      jsonb_build_object('reason', 'COUNCIL_REQUIRED')
    );
  END IF;

  SELECT d.id, d.campaign_id, d.voided_at
    INTO v_delivery
    FROM public.deliveries d
   WHERE d.id = p_delivery_id
     AND d.council_id = v_council_id
   FOR UPDATE;

  IF NOT FOUND THEN
    PERFORM private.raise_business_error('NOT_FOUND');
  END IF;

  SELECT c.status INTO v_campaign_status
    FROM public.campaigns c
   WHERE c.id = v_delivery.campaign_id;

  IF v_campaign_status <> 'DELIVERY' THEN
    PERFORM private.raise_business_error('CAMPAIGN_NOT_IN_DELIVERY');
  END IF;

  IF v_delivery.voided_at IS NOT NULL THEN
    PERFORM private.raise_business_error('DELIVERY_ALREADY_VOIDED');
  END IF;

  IF v_reason IS NULL OR char_length(v_reason) < 10 THEN
    PERFORM private.raise_business_error('REASON_REQUIRED');
  END IF;

  PERFORM private.set_audit_context(v_user_id, 'DELIVERY_VOIDED', v_reason);

  UPDATE public.deliveries
     SET voided_at = now(),
         voided_by_user_id = v_user_id,
         void_reason = v_reason
   WHERE id = v_delivery.id;

  RETURN jsonb_build_object('delivery_id', v_delivery.id);
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_delivery(
  uuid, public.withdrawal_type, text, text, boolean, boolean
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_delivery(
  uuid, public.withdrawal_type, text, text, boolean, boolean
) TO authenticated;

REVOKE ALL ON FUNCTION public.void_delivery(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.void_delivery(uuid, text) TO authenticated;
