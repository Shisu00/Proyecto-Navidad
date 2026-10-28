-- Estadísticas temporales (HU-27) y proyección de compras (CR-09, SPECS §8.7).
-- Son SECURITY INVOKER: heredan la RLS de quien consulta y exigen planning.read.
-- Las fechas se agrupan en hora de Chile, no en UTC.

-- Inscripciones registradas por semana (lunes a domingo), sin contar las descartadas
CREATE OR REPLACE FUNCTION public.get_inscription_weekly(p_campaign_id uuid)
RETURNS TABLE (week_start date, registered integer)
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
BEGIN
  PERFORM private.require_permission('planning.read');

  RETURN QUERY
  SELECT
    (date_trunc('week', i.created_at AT TIME ZONE 'America/Santiago'))::date,
    count(*)::integer
    FROM public.inscriptions i
   WHERE i.campaign_id = p_campaign_id
     AND i.status <> 'DISCARDED'
   GROUP BY 1
   ORDER BY 1;
END;
$$;

-- Entregas por día: vigentes y anuladas (una anulada cuenta en el día en que se entregó)
CREATE OR REPLACE FUNCTION public.get_delivery_daily(p_campaign_id uuid)
RETURNS TABLE (day date, delivered integer, voided integer)
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
BEGIN
  PERFORM private.require_permission('planning.read');

  RETURN QUERY
  SELECT
    (d.delivered_at AT TIME ZONE 'America/Santiago')::date,
    (count(*) FILTER (WHERE d.voided_at IS NULL))::integer,
    (count(*) FILTER (WHERE d.voided_at IS NOT NULL))::integer
    FROM public.deliveries d
   WHERE d.campaign_id = p_campaign_id
   GROUP BY 1
   ORDER BY 1;
END;
$$;

-- Una fila por territorio, rango etario y sexo.
-- Referencia: la última campaña CLOSED de un año anterior. Proyección = validados actuales ×
-- (entregados / validados de la referencia), redondeada hacia arriba por segmento.
-- Sin referencia, o sin validados en ese segmento de la referencia, la proyección es nula.
CREATE OR REPLACE FUNCTION public.get_purchase_projection(p_campaign_id uuid)
RETURNS TABLE (
  territory_id uuid,
  territory_name text,
  age_range public.age_range,
  sex public.sex,
  validated integer,
  delivered integer,
  delivery_rate numeric,
  reference_campaign_id uuid,
  reference_campaign_name text,
  reference_validated integer,
  reference_delivered integer,
  reference_rate numeric,
  projected integer
)
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
#variable_conflict use_column
DECLARE
  v_year integer;
  v_ref_id uuid;
  v_ref_name text;
BEGIN
  PERFORM private.require_permission('planning.read');

  SELECT c.year INTO v_year FROM public.campaigns c WHERE c.id = p_campaign_id;
  IF NOT FOUND THEN
    PERFORM private.raise_business_error('NOT_FOUND');
  END IF;

  SELECT c.id, c.name
    INTO v_ref_id, v_ref_name
    FROM public.campaigns c
   WHERE c.status = 'CLOSED' AND c.year < v_year
   ORDER BY c.year DESC
   LIMIT 1;

  RETURN QUERY
  WITH cur AS (
    SELECT i.territory_id AS t_id, i.age_range AS a_range, i.sex AS s_sex,
           count(*)::integer AS n_validated,
           count(d.id)::integer AS n_delivered
      FROM public.inscriptions i
      LEFT JOIN public.deliveries d
        ON d.inscription_id = i.id AND d.voided_at IS NULL
     WHERE i.campaign_id = p_campaign_id
       AND i.status = 'VALIDATED'
       AND i.age_range IS NOT NULL
     GROUP BY i.territory_id, i.age_range, i.sex
  ),
  ref AS (
    SELECT i.territory_id AS t_id, i.age_range AS a_range, i.sex AS s_sex,
           count(*)::integer AS n_validated,
           count(d.id)::integer AS n_delivered
      FROM public.inscriptions i
      LEFT JOIN public.deliveries d
        ON d.inscription_id = i.id AND d.voided_at IS NULL
     WHERE i.campaign_id = v_ref_id
       AND i.status = 'VALIDATED'
       AND i.age_range IS NOT NULL
     GROUP BY i.territory_id, i.age_range, i.sex
  ),
  segments AS (
    SELECT t_id, a_range, s_sex FROM cur
    UNION
    SELECT t_id, a_range, s_sex FROM ref
  )
  SELECT
    t.id,
    t.name,
    s.a_range,
    s.s_sex,
    coalesce(cur.n_validated, 0),
    coalesce(cur.n_delivered, 0),
    CASE WHEN cur.n_validated > 0
         THEN round(cur.n_delivered::numeric / cur.n_validated, 4) END,
    v_ref_id,
    v_ref_name,
    coalesce(ref.n_validated, 0),
    coalesce(ref.n_delivered, 0),
    CASE WHEN ref.n_validated > 0
         THEN round(ref.n_delivered::numeric / ref.n_validated, 4) END,
    CASE WHEN ref.n_validated > 0
         THEN ceil(coalesce(cur.n_validated, 0)::numeric * ref.n_delivered / ref.n_validated)::integer
    END
    FROM segments s
    JOIN public.territories t ON t.id = s.t_id
    LEFT JOIN cur ON cur.t_id = s.t_id AND cur.a_range = s.a_range AND cur.s_sex = s.s_sex
    LEFT JOIN ref ON ref.t_id = s.t_id AND ref.a_range = s.a_range AND ref.s_sex = s.s_sex
   ORDER BY t.name, s.a_range, s.s_sex;
END;
$$;

REVOKE ALL ON FUNCTION public.get_inscription_weekly(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_delivery_daily(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_purchase_projection(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_inscription_weekly(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_delivery_daily(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_purchase_projection(uuid) TO authenticated;
