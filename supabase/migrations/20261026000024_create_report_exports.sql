-- Informes exportables (inscripciones, entregas) y RUN en la exportación de auditoría.
-- Las vistas son security_invoker: quien consulta ve solo lo que su RLS le permite.
-- Quien no pueda leer inscripciones, niños o adultos recibe las columnas de RUN vacías.

INSERT INTO public.permissions (code, description) VALUES
  ('data.export', 'Exportar informes de inscripciones y entregas a CSV');

INSERT INTO public.role_permissions (role_id, permission_code)
SELECT r.id, 'data.export'
  FROM public.roles r
 WHERE r.code IN ('ADMIN', 'MUNICIPAL_OFFICER');

-- Auditoría con la identificación resuelta. El RUN no vive en audit_log (guarda ids internos):
-- se obtiene del niño o del adulto del registro, tal como estaba en el momento del evento.
CREATE OR REPLACE VIEW public.audit_log_export
WITH (security_invoker = true)
AS
SELECT
  a.id,
  a.occurred_at,
  a.actor_user_id,
  a.action,
  a.entity_type,
  a.entity_id,
  a.previous_state,
  a.new_state,
  a.reason,
  bn.id_type AS beneficiary_id_type,
  bn.normalized_id_number AS beneficiary_run,
  bo.id_type AS previous_beneficiary_id_type,
  bo.normalized_id_number AS previous_beneficiary_run,
  gn.normalized_id_number AS guardian_run,
  go_.normalized_id_number AS previous_guardian_run,
  CASE WHEN a.entity_type = 'deliveries' THEN a.new_state ->> 'withdrawer_id_number' END
    AS withdrawer_run
FROM public.audit_log a
-- Entregas y casos de calidad apuntan a la inscripción desde su estado
LEFT JOIN public.inscriptions i
  ON i.id = CASE
       WHEN a.entity_type IN ('deliveries', 'quality_cases')
       THEN (a.new_state ->> 'inscription_id')::uuid
     END
LEFT JOIN public.beneficiaries bn
  ON bn.id = COALESCE(
       CASE WHEN a.entity_type = 'inscriptions' THEN (a.new_state ->> 'beneficiary_id')::uuid END,
       i.beneficiary_id
     )
LEFT JOIN public.guardians gn
  ON gn.id = COALESCE(
       CASE WHEN a.entity_type = 'inscriptions' THEN (a.new_state ->> 'guardian_id')::uuid END,
       i.guardian_id
     )
LEFT JOIN public.beneficiaries bo
  ON bo.id = CASE
       WHEN a.entity_type = 'inscriptions' THEN (a.previous_state ->> 'beneficiary_id')::uuid
     END
LEFT JOIN public.guardians go_
  ON go_.id = CASE
       WHEN a.entity_type = 'inscriptions' THEN (a.previous_state ->> 'guardian_id')::uuid
     END;

GRANT SELECT ON public.audit_log_export TO authenticated;

-- Evidencia de entregas (HU-26): una fila por entrega, vigente o anulada
CREATE OR REPLACE VIEW public.delivery_report
WITH (security_invoker = true)
AS
SELECT
  d.id,
  d.campaign_id,
  d.council_id,
  nc.name AS council_name,
  t.name AS territory_name,
  d.delivered_at,
  d.withdrawal_type,
  d.withdrawer_id_number,
  d.observation,
  d.responsibility_confirmed,
  d.scanned_from_id_card,
  pb.full_name AS delivered_by_name,
  (d.voided_at IS NOT NULL) AS is_voided,
  d.voided_at,
  pv.full_name AS voided_by_name,
  d.void_reason,
  b.id_type AS beneficiary_id_type,
  b.normalized_id_number AS beneficiary_id_number,
  g.full_name AS guardian_full_name,
  g.normalized_id_number AS guardian_id_number
FROM public.deliveries d
JOIN public.inscriptions i ON i.id = d.inscription_id
JOIN public.beneficiaries b ON b.id = i.beneficiary_id
JOIN public.guardians g ON g.id = i.guardian_id
JOIN public.neighborhood_councils nc ON nc.id = d.council_id
JOIN public.territories t ON t.id = d.territory_id
LEFT JOIN public.profiles pb ON pb.id = d.delivered_by_user_id
LEFT JOIN public.profiles pv ON pv.id = d.voided_by_user_id;

GRANT SELECT ON public.delivery_report TO authenticated;

-- Constancia de cada informe exportado (el de auditoría tiene su propia función)
CREATE OR REPLACE FUNCTION public.register_data_export(
  p_report text,
  p_filters jsonb,
  p_row_count integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM private.require_permission('data.export');

  IF p_report NOT IN ('INSCRIPTIONS', 'DELIVERIES')
     OR p_row_count IS NULL OR p_row_count < 0
     OR (p_filters IS NOT NULL AND jsonb_typeof(p_filters) <> 'object') THEN
    PERFORM private.raise_business_error('VALIDATION_ERROR');
  END IF;

  INSERT INTO public.audit_log (actor_user_id, action, entity_type, entity_id, new_state)
  VALUES (
    auth.uid(),
    'DATA_EXPORTED',
    'reports',
    p_report,
    jsonb_build_object('filters', coalesce(p_filters, '{}'::jsonb), 'row_count', p_row_count)
  );

  RETURN jsonb_build_object('row_count', p_row_count);
END;
$$;

REVOKE ALL ON FUNCTION public.register_data_export(text, jsonb, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_data_export(text, jsonb, integer) TO authenticated;
