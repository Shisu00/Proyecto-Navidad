-- Vista inscription_overview (SPECS §3.5).
-- security_invoker: hereda la RLS de quien consulta. Una JJVV solo ve lo suyo,
-- y open_cases_count es 0 para quien no tiene quality.read.

CREATE VIEW public.inscription_overview
WITH (security_invoker = true)
AS
SELECT
  i.id,
  i.campaign_id,
  i.status,
  i.created_at,
  i.council_id,
  nc.name AS council_name,
  i.territory_id,
  t.name AS territory_name,
  i.beneficiary_id,
  b.id_type AS beneficiary_id_type,
  b.normalized_id_number AS beneficiary_id_number,
  i.sex,
  i.birth_date,
  i.age_at_cutoff,
  i.age_range,
  i.guardian_id,
  g.full_name AS guardian_full_name,
  g.normalized_id_number AS guardian_id_number,
  g.email AS guardian_email,
  g.phone AS guardian_phone,
  i.duplicate_justification,
  -- Verdadero aunque la inscripción ya esté VALIDATED
  (i.duplicate_justification IS NOT NULL) AS has_observation,
  oc.open_cases_count,
  -- Solo la entrega vigente (no anulada)
  d.id AS delivery_id,
  d.delivered_at
FROM public.inscriptions i
JOIN public.beneficiaries b ON b.id = i.beneficiary_id
JOIN public.guardians g ON g.id = i.guardian_id
JOIN public.neighborhood_councils nc ON nc.id = i.council_id
JOIN public.territories t ON t.id = i.territory_id
LEFT JOIN public.deliveries d
  ON d.inscription_id = i.id
 AND d.voided_at IS NULL
LEFT JOIN LATERAL (
  SELECT count(*)::integer AS open_cases_count
    FROM public.quality_cases qc
   WHERE qc.inscription_id = i.id
     AND qc.status = 'OPEN'
) oc ON true;

GRANT SELECT ON public.inscription_overview TO authenticated;
