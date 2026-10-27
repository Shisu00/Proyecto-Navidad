-- Reportes (SECURITY INVOKER: heredan la RLS de quien consulta) y transición de campaña.

CREATE OR REPLACE FUNCTION public.get_campaign_summary(p_campaign_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
BEGIN
  PERFORM private.require_active_user();

  -- "Entregado" = validada con entrega vigente (SPECS §8.6)
  RETURN (
    SELECT jsonb_build_object(
      'enrolled', count(*) FILTER (WHERE i.status <> 'DISCARDED'),
      'validated', count(*) FILTER (WHERE i.status = 'VALIDATED'),
      'missing', count(*) FILTER (WHERE i.status IN ('PENDING', 'OBSERVED')),
      'discarded', count(*) FILTER (WHERE i.status = 'DISCARDED'),
      'delivered', count(*) FILTER (WHERE i.status = 'VALIDATED' AND d.id IS NOT NULL),
      'pending_delivery', count(*) FILTER (WHERE i.status = 'VALIDATED' AND d.id IS NULL)
    )
      FROM public.inscriptions i
      LEFT JOIN public.deliveries d
        ON d.inscription_id = i.id
       AND d.voided_at IS NULL
     WHERE i.campaign_id = p_campaign_id
  );
END;
$$;

-- Incluye JJVV sin validados para que aparezcan con avance cero
CREATE OR REPLACE FUNCTION public.get_delivery_progress(p_campaign_id uuid)
RETURNS TABLE (
  territory_id uuid,
  territory_name text,
  council_id uuid,
  council_name text,
  validated integer,
  delivered integer,
  pending_delivery integer
)
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
BEGIN
  PERFORM private.require_permission('planning.read');

  RETURN QUERY
  SELECT
    t.id,
    t.name,
    nc.id,
    nc.name,
    (count(i.id) FILTER (WHERE i.status = 'VALIDATED'))::integer,
    (count(d.id) FILTER (WHERE i.status = 'VALIDATED'))::integer,
    (
      count(i.id) FILTER (WHERE i.status = 'VALIDATED')
      - count(d.id) FILTER (WHERE i.status = 'VALIDATED')
    )::integer
    FROM public.neighborhood_councils nc
    JOIN public.territories t ON t.id = nc.territory_id
    LEFT JOIN public.inscriptions i
      ON i.council_id = nc.id
     AND i.campaign_id = p_campaign_id
    LEFT JOIN public.deliveries d
      ON d.inscription_id = i.id
     AND d.voided_at IS NULL
   GROUP BY t.id, t.name, nc.id, nc.name
   ORDER BY t.name, nc.name;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_planning_counts(p_campaign_id uuid)
RETURNS TABLE (
  territory_id uuid,
  territory_name text,
  age_range public.age_range,
  sex public.sex,
  validated integer
)
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
BEGIN
  PERFORM private.require_permission('planning.read');

  RETURN QUERY
  SELECT t.id, t.name, i.age_range, i.sex, count(*)::integer
    FROM public.inscriptions i
    JOIN public.territories t ON t.id = i.territory_id
   WHERE i.campaign_id = p_campaign_id
     AND i.status = 'VALIDATED'
     AND i.age_range IS NOT NULL
   GROUP BY t.id, t.name, i.age_range, i.sex
   ORDER BY t.name, i.age_range, i.sex;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_transition_campaign(
  p_campaign_id uuid,
  p_target_status public.campaign_status,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_current public.campaign_status;
  v_order public.campaign_status[] := enum_range(NULL::public.campaign_status);
  v_position integer;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_is_rollback boolean;
BEGIN
  PERFORM private.require_permission('catalog.manage');

  SELECT c.status INTO v_current
    FROM public.campaigns c
   WHERE c.id = p_campaign_id
   FOR UPDATE;

  IF NOT FOUND THEN
    PERFORM private.raise_business_error('NOT_FOUND');
  END IF;

  v_position := array_position(v_order, v_current);

  -- CLOSED es terminal; el resto solo se mueve un estado hacia adelante o atrás
  IF v_current = 'CLOSED'
     OR p_target_status IS NULL
     OR p_target_status NOT IN (v_order[v_position + 1], v_order[v_position - 1]) THEN
    PERFORM private.raise_business_error(
      'INVALID_STATE_TRANSITION',
      jsonb_build_object('from', v_current, 'to', p_target_status)
    );
  END IF;

  v_is_rollback := array_position(v_order, p_target_status) < v_position;
  IF v_is_rollback AND v_reason IS NULL THEN
    PERFORM private.raise_business_error('REASON_REQUIRED');
  END IF;

  PERFORM private.set_audit_context(auth.uid(), 'CAMPAIGN_STATUS_CHANGED', v_reason);
  UPDATE public.campaigns SET status = p_target_status WHERE id = p_campaign_id;

  RETURN jsonb_build_object('campaign_id', p_campaign_id, 'status', p_target_status);
END;
$$;

REVOKE ALL ON FUNCTION public.get_campaign_summary(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_delivery_progress(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_planning_counts(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_transition_campaign(uuid, public.campaign_status, text)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_campaign_summary(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_delivery_progress(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_planning_counts(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_transition_campaign(uuid, public.campaign_status, text)
  TO authenticated;
