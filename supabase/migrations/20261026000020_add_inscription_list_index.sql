-- Índice para el listado paginado: WHERE campaign_id = X ORDER BY created_at DESC LIMIT n.
-- Evita ordenar todas las inscripciones de la campaña en cada página (prueba de carga, 13.500 filas).
-- id como desempate mantiene estable el orden entre páginas.

CREATE INDEX IF NOT EXISTS inscriptions_campaign_created_idx
  ON public.inscriptions (campaign_id, created_at DESC, id DESC);
