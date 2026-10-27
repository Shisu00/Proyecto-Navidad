-- Catálogos territoriales, roles dinámicos, permisos y perfiles (SPECS §3.2, §4.4).

CREATE TABLE public.territories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT territories_name_key UNIQUE (name),
  CONSTRAINT territories_name_not_blank CHECK (btrim(name) <> '')
);

CREATE TABLE public.neighborhood_councils (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  territory_id uuid NOT NULL REFERENCES public.territories (id),
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT neighborhood_councils_name_not_blank CHECK (btrim(name) <> ''),
  -- Habilita las FK compuestas (council_id, territory_id) de otras tablas
  CONSTRAINT neighborhood_councils_id_territory_key UNIQUE (id, territory_id),
  CONSTRAINT neighborhood_councils_territory_name_key UNIQUE (territory_id, name)
);

-- Los roles son datos, no un enum (SPECS §3.1).
CREATE TABLE public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  name text NOT NULL,
  is_system boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  requires_council boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT roles_code_key UNIQUE (code),
  CONSTRAINT roles_code_format CHECK (code ~ '^[A-Z][A-Z0-9_]*$'),
  CONSTRAINT roles_name_not_blank CHECK (btrim(name) <> '')
);

-- El catálogo de permisos lo define el código mediante migraciones.
CREATE TABLE public.permissions (
  code text PRIMARY KEY,
  description text NOT NULL,
  CONSTRAINT permissions_code_format CHECK (code ~ '^[a-z_]+\.[a-z_]+$')
);

CREATE TABLE public.role_permissions (
  role_id uuid NOT NULL REFERENCES public.roles (id),
  permission_code text NOT NULL REFERENCES public.permissions (code),
  PRIMARY KEY (role_id, permission_code)
);

-- Sin política INSERT para clientes: las cuentas las crea el panel de
-- administración mediante RPC (SPECS §4.1).
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id),
  full_name text NOT NULL,
  role_id uuid NOT NULL REFERENCES public.roles (id),
  territory_id uuid,
  council_id uuid,
  is_active boolean NOT NULL DEFAULT true,
  must_change_password boolean NOT NULL DEFAULT true,
  password_changed_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profiles_full_name_not_blank CHECK (btrim(full_name) <> ''),
  CONSTRAINT profiles_council_requires_territory
    CHECK (council_id IS NULL OR territory_id IS NOT NULL),
  CONSTRAINT profiles_territory_fkey
    FOREIGN KEY (territory_id) REFERENCES public.territories (id),
  CONSTRAINT profiles_council_territory_fkey
    FOREIGN KEY (council_id, territory_id)
    REFERENCES public.neighborhood_councils (id, territory_id)
);

CREATE INDEX profiles_role_id_idx ON public.profiles (role_id);
CREATE INDEX profiles_council_id_idx ON public.profiles (council_id);

-- Si el rol exige JJVV, territorio y JJVV son obligatorios (SPECS §3.2).
CREATE OR REPLACE FUNCTION private.validate_profile_scope()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_requires_council boolean;
BEGIN
  SELECT r.requires_council
    INTO v_requires_council
    FROM public.roles r
   WHERE r.id = NEW.role_id;

  IF v_requires_council AND (NEW.territory_id IS NULL OR NEW.council_id IS NULL) THEN
    PERFORM private.raise_business_error(
      'VALIDATION_ERROR',
      jsonb_build_object('field', 'council_id', 'reason', 'COUNCIL_REQUIRED_FOR_ROLE')
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_validate_scope
  BEFORE INSERT OR UPDATE OF role_id, territory_id, council_id ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION private.validate_profile_scope();

CREATE TRIGGER territories_set_updated_at
  BEFORE UPDATE ON public.territories
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER neighborhood_councils_set_updated_at
  BEFORE UPDATE ON public.neighborhood_councils
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER roles_set_updated_at
  BEFORE UPDATE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
