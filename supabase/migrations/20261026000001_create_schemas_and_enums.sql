-- Esquemas y tipos enumerados base del sistema (SPECS §3.1).

CREATE SCHEMA IF NOT EXISTS private;

-- private no se expone por PostgREST. USAGE se concede solo para que
-- las políticas RLS puedan invocar los helpers.
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

-- El orden de los valores define el orden de avance de la campaña.
CREATE TYPE public.campaign_status AS ENUM (
  'PLANNED',
  'REGISTRATION_OPEN',
  'REGISTRATION_CLOSED',
  'VALIDATION',
  'DELIVERY_PLANNED',
  'DELIVERY',
  'CLOSED'
);

CREATE TYPE public.inscription_status AS ENUM (
  'PENDING',
  'OBSERVED',
  'VALIDATED',
  'DISCARDED'
);

CREATE TYPE public.age_range AS ENUM (
  'AGE_0_3',
  'AGE_4_7',
  'AGE_8_10'
);

CREATE TYPE public.sex AS ENUM (
  'FEMALE',
  'MALE'
);

CREATE TYPE public.id_number_type AS ENUM (
  'RUT',
  'IPE'
);

CREATE TYPE public.withdrawal_type AS ENUM (
  'STANDARD',
  'SUBSIDIARY'
);

-- Los valores no están definidos en las specs; ajustar si cambia el criterio.
CREATE TYPE public.quality_severity AS ENUM (
  'LOW',
  'MEDIUM',
  'HIGH'
);

CREATE TYPE public.quality_case_status AS ENUM (
  'OPEN',
  'RESOLVED'
);
