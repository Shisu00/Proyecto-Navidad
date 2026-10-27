-- Motor de calidad y entregas (SPECS §3.2, §3.3, §6).

CREATE TABLE public.quality_rules (
  code text PRIMARY KEY,
  name text NOT NULL,
  description text,
  severity public.quality_severity NOT NULL,
  -- Función evaluadora(inscription_id); agregar una regla no toca submit_inscription
  evaluator_function text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quality_rules_code_format CHECK (code ~ '^Q[0-9]{3}$')
);

CREATE TABLE public.quality_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inscription_id uuid NOT NULL REFERENCES public.inscriptions (id),
  rule_code text NOT NULL REFERENCES public.quality_rules (code),
  related_inscription_id uuid REFERENCES public.inscriptions (id),
  status public.quality_case_status NOT NULL DEFAULT 'OPEN',
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES public.profiles (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quality_cases_resolution_consistent
    CHECK ((status = 'OPEN') = (resolved_at IS NULL))
);

-- Un caso abierto por (inscripción, regla, relacionada)
CREATE UNIQUE INDEX quality_cases_open_key
  ON public.quality_cases (
    inscription_id,
    rule_code,
    (COALESCE(related_inscription_id, '00000000-0000-0000-0000-000000000000'::uuid))
  )
  WHERE status = 'OPEN';

CREATE INDEX quality_cases_inscription_idx ON public.quality_cases (inscription_id);

CREATE TABLE public.deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inscription_id uuid NOT NULL,
  -- Denormalizados desde la inscripción para RLS y Realtime
  campaign_id uuid NOT NULL,
  council_id uuid NOT NULL,
  territory_id uuid NOT NULL,
  delivered_by_user_id uuid NOT NULL REFERENCES public.profiles (id),
  delivered_at timestamptz NOT NULL DEFAULT now(),
  withdrawal_type public.withdrawal_type NOT NULL,
  withdrawer_id_number text,
  observation text,
  responsibility_confirmed boolean NOT NULL DEFAULT false,
  scanned_from_id_card boolean NOT NULL DEFAULT false,
  voided_at timestamptz,
  voided_by_user_id uuid REFERENCES public.profiles (id),
  void_reason text,
  -- Garantiza que los campos denormalizados coincidan con la inscripción
  CONSTRAINT deliveries_inscription_scope_fkey
    FOREIGN KEY (inscription_id, campaign_id, council_id, territory_id)
    REFERENCES public.inscriptions (id, campaign_id, council_id, territory_id),
  CONSTRAINT deliveries_withdrawer_valid
    CHECK (withdrawer_id_number IS NULL OR private.is_valid_rut(withdrawer_id_number)),
  CONSTRAINT deliveries_standard_requires_withdrawer
    CHECK (withdrawal_type <> 'STANDARD' OR withdrawer_id_number IS NOT NULL),
  CONSTRAINT deliveries_subsidiary_requires_observation
    CHECK (
      withdrawal_type <> 'SUBSIDIARY'
      OR char_length(btrim(coalesce(observation, ''))) >= 10
    ),
  CONSTRAINT deliveries_subsidiary_requires_responsibility
    CHECK (withdrawal_type <> 'SUBSIDIARY' OR responsibility_confirmed),
  CONSTRAINT deliveries_void_consistent
    CHECK (
      (voided_at IS NULL AND voided_by_user_id IS NULL AND void_reason IS NULL)
      OR (
        voided_at IS NOT NULL
        AND voided_by_user_id IS NOT NULL
        AND char_length(btrim(coalesce(void_reason, ''))) >= 10
      )
    )
);

-- Una sola entrega vigente por inscripción; una anulada no bloquea otra nueva.
CREATE UNIQUE INDEX deliveries_active_inscription_key
  ON public.deliveries (inscription_id)
  WHERE voided_at IS NULL;

CREATE INDEX deliveries_campaign_council_idx
  ON public.deliveries (campaign_id, council_id);

-- Solo se puede anular, y una única vez. Corregir una entrega equivale a
-- anularla y registrar una nueva (SPECS §3.3).
CREATE OR REPLACE FUNCTION private.protect_delivery_immutability()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.voided_at IS NOT NULL THEN
    PERFORM private.raise_business_error(
      'DELIVERY_ALREADY_VOIDED',
      jsonb_build_object('delivery_id', OLD.id)
    );
  END IF;

  IF (to_jsonb(NEW) - 'voided_at' - 'voided_by_user_id' - 'void_reason')
     IS DISTINCT FROM
     (to_jsonb(OLD) - 'voided_at' - 'voided_by_user_id' - 'void_reason') THEN
    PERFORM private.raise_business_error(
      'VALIDATION_ERROR',
      jsonb_build_object('reason', 'DELIVERY_IMMUTABLE', 'delivery_id', OLD.id)
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER deliveries_protect_immutability
  BEFORE UPDATE ON public.deliveries
  FOR EACH ROW EXECUTE FUNCTION private.protect_delivery_immutability();

-- Realtime sobre deliveries (altas y anulaciones). La suscripción respeta RLS.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.deliveries;
  END IF;
END;
$$;
