-- Helpers privados: errores de negocio, identificación (RUT/IPE) y edad.

-- Errores de negocio (SPECS §5): SQLSTATE P0001, message = código, detail = JSON.
CREATE OR REPLACE FUNCTION private.raise_business_error(
  p_code text,
  p_details jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION '%', p_code USING ERRCODE = 'P0001', DETAIL = p_details::text;
END;
$$;

CREATE OR REPLACE FUNCTION private.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- Nunca hay DELETE físico sobre datos de negocio (SPECS §1).
CREATE OR REPLACE FUNCTION private.reject_physical_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  PERFORM private.raise_business_error(
    'FORBIDDEN',
    jsonb_build_object('reason', 'PHYSICAL_DELETE_NOT_ALLOWED', 'table', TG_TABLE_NAME)
  );
  RETURN NULL;
END;
$$;

-- Quita puntos, guion y espacios; deja dígitos y K mayúscula.
CREATE OR REPLACE FUNCTION private.normalize_id_number(p_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT upper(regexp_replace(coalesce(p_value, ''), '[^0-9kK]', '', 'g'));
$$;

-- RUT normalizado: cuerpo de 7 a 8 dígitos + verificador por módulo 11.
CREATE OR REPLACE FUNCTION private.is_valid_rut(p_normalized text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
DECLARE
  v_body text;
  v_check_digit text;
  v_sum integer := 0;
  v_factor integer := 2;
  v_remainder integer;
  v_expected text;
  v_index integer;
BEGIN
  IF p_normalized IS NULL OR p_normalized !~ '^[0-9]{7,8}[0-9K]$' THEN
    RETURN false;
  END IF;

  v_body := left(p_normalized, -1);
  v_check_digit := right(p_normalized, 1);

  FOR v_index IN REVERSE length(v_body)..1 LOOP
    v_sum := v_sum + substr(v_body, v_index, 1)::integer * v_factor;
    v_factor := CASE WHEN v_factor = 7 THEN 2 ELSE v_factor + 1 END;
  END LOOP;

  v_remainder := 11 - (v_sum % 11);
  v_expected := CASE v_remainder
    WHEN 11 THEN '0'
    WHEN 10 THEN 'K'
    ELSE v_remainder::text
  END;

  RETURN v_check_digit = v_expected;
END;
$$;

-- IPE: solo estructura (9 dígitos + verificador, 10 sin separadores), sin
-- módulo 11. Es el único lugar del patrón; su espejo vive en
-- portal/src/lib/identification.js (SPECS §3.4).
CREATE OR REPLACE FUNCTION private.is_valid_ipe(p_normalized text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT coalesce(p_normalized ~ '^[0-9]{10}$', false);
$$;

CREATE OR REPLACE FUNCTION private.is_valid_id_number(
  p_type public.id_number_type,
  p_normalized text
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT CASE p_type
    WHEN 'RUT' THEN private.is_valid_rut(p_normalized)
    WHEN 'IPE' THEN private.is_valid_ipe(p_normalized)
    ELSE false
  END;
$$;

-- Edad cumplida a una fecha de referencia. Se calcula con mes y día para
-- no depender de la zona horaria de la sesión.
CREATE OR REPLACE FUNCTION private.calculate_age(
  p_birth_date date,
  p_reference_date date
)
RETURNS integer
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT (extract(year FROM p_reference_date) - extract(year FROM p_birth_date))::integer
    - CASE
        WHEN (extract(month FROM p_reference_date), extract(day FROM p_reference_date))
           < (extract(month FROM p_birth_date), extract(day FROM p_birth_date)) THEN 1
        ELSE 0
      END;
$$;

-- NULL cuando la edad cae fuera de 0–10 (regla de calidad Q003).
CREATE OR REPLACE FUNCTION private.age_range_for_age(p_age integer)
RETURNS public.age_range
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_age BETWEEN 0 AND 3 THEN 'AGE_0_3'::public.age_range
    WHEN p_age BETWEEN 4 AND 7 THEN 'AGE_4_7'::public.age_range
    WHEN p_age BETWEEN 8 AND 10 THEN 'AGE_8_10'::public.age_range
    ELSE NULL
  END;
$$;
