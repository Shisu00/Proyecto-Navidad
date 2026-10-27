-- Campañas, beneficiarios, adultos responsables e inscripciones (SPECS §3.2, §3.4, §7).

CREATE TABLE public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year integer NOT NULL,
  name text NOT NULL,
  status public.campaign_status NOT NULL DEFAULT 'PLANNED',
  age_cutoff_date date NOT NULL,
  auto_validate_clean_inscriptions boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT campaigns_year_key UNIQUE (year),
  CONSTRAINT campaigns_year_range CHECK (year BETWEEN 2000 AND 2100),
  CONSTRAINT campaigns_name_not_blank CHECK (btrim(name) <> '')
);

CREATE TABLE public.beneficiaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_type public.id_number_type NOT NULL,
  normalized_id_number text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Un RUT y un IPE con el mismo texto nunca colisionan
  CONSTRAINT beneficiaries_id_key UNIQUE (id_type, normalized_id_number),
  CONSTRAINT beneficiaries_id_number_valid
    CHECK (private.is_valid_id_number(id_type, normalized_id_number))
);

-- El RUT del adulto no es único: los datos contradictorios del mismo
-- adulto se conservan (SPECS §3.2).
CREATE TABLE public.guardians (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  normalized_id_number text NOT NULL,
  email text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT guardians_full_name_not_blank CHECK (btrim(full_name) <> ''),
  CONSTRAINT guardians_id_number_valid CHECK (private.is_valid_rut(normalized_id_number)),
  CONSTRAINT guardians_email_format
    CHECK (email IS NULL OR email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
);

CREATE INDEX guardians_normalized_id_number_idx ON public.guardians (normalized_id_number);

CREATE TABLE public.inscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns (id),
  beneficiary_id uuid NOT NULL REFERENCES public.beneficiaries (id),
  guardian_id uuid NOT NULL REFERENCES public.guardians (id),
  council_id uuid NOT NULL,
  territory_id uuid NOT NULL,
  status public.inscription_status NOT NULL DEFAULT 'PENDING',
  -- Snapshots al momento de inscribir
  birth_date date NOT NULL,
  sex public.sex NOT NULL,
  -- Derivados de birth_date y la fecha de corte de la campaña (trigger)
  age_at_cutoff integer NOT NULL,
  age_range public.age_range,
  client_operation_id uuid NOT NULL,
  duplicate_justification text,
  created_by uuid NOT NULL REFERENCES public.profiles (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inscriptions_council_territory_fkey
    FOREIGN KEY (council_id, territory_id)
    REFERENCES public.neighborhood_councils (id, territory_id),
  CONSTRAINT inscriptions_operation_key UNIQUE (created_by, client_operation_id),
  -- Habilita la FK compuesta desde deliveries
  CONSTRAINT inscriptions_delivery_scope_key
    UNIQUE (id, campaign_id, council_id, territory_id),
  CONSTRAINT inscriptions_age_range_consistent
    CHECK (age_range IS NOT DISTINCT FROM private.age_range_for_age(age_at_cutoff)),
  CONSTRAINT inscriptions_justification_length
    CHECK (
      duplicate_justification IS NULL
      OR char_length(btrim(duplicate_justification)) >= 10
    )
);

-- Una sola inscripción "principal" por niño y campaña. Los duplicados
-- justificados quedan fuera del índice y no tienen tope (SPECS §7, inv. 1).
CREATE UNIQUE INDEX inscriptions_primary_per_beneficiary_campaign_key
  ON public.inscriptions (campaign_id, beneficiary_id)
  WHERE duplicate_justification IS NULL AND status <> 'DISCARDED';

CREATE INDEX inscriptions_campaign_beneficiary_idx
  ON public.inscriptions (campaign_id, beneficiary_id);
CREATE INDEX inscriptions_campaign_status_idx
  ON public.inscriptions (campaign_id, status);
CREATE INDEX inscriptions_campaign_council_idx
  ON public.inscriptions (campaign_id, council_id);
CREATE INDEX inscriptions_guardian_id_idx
  ON public.inscriptions (guardian_id);
CREATE INDEX inscriptions_beneficiary_id_idx
  ON public.inscriptions (beneficiary_id);

-- Un CHECK no puede consultar otra tabla, así que la edad se calcula aquí
-- con la fecha de corte de la campaña, nunca con una constante (SPECS §7, inv. 3).
CREATE OR REPLACE FUNCTION private.set_inscription_age()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_cutoff_date date;
BEGIN
  SELECT c.age_cutoff_date
    INTO v_cutoff_date
    FROM public.campaigns c
   WHERE c.id = NEW.campaign_id;

  NEW.age_at_cutoff := private.calculate_age(NEW.birth_date, v_cutoff_date);
  NEW.age_range := private.age_range_for_age(NEW.age_at_cutoff);
  RETURN NEW;
END;
$$;

CREATE TRIGGER inscriptions_set_age
  BEFORE INSERT OR UPDATE OF birth_date, campaign_id ON public.inscriptions
  FOR EACH ROW EXECUTE FUNCTION private.set_inscription_age();

CREATE TRIGGER campaigns_set_updated_at
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER inscriptions_set_updated_at
  BEFORE UPDATE ON public.inscriptions
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
