-- Auditoría inmutable y bloqueo de DELETE físico (SPECS §4.6, §7 inv. 6).

CREATE TABLE public.audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  -- Sin FK a propósito: la auditoría debe sobrevivir a cualquier cuenta
  actor_user_id uuid,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  previous_state jsonb,
  new_state jsonb,
  reason text
);

CREATE INDEX audit_log_entity_idx ON public.audit_log (entity_type, entity_id);
CREATE INDEX audit_log_occurred_at_idx ON public.audit_log (occurred_at DESC);
CREATE INDEX audit_log_action_idx ON public.audit_log (action);

CREATE OR REPLACE FUNCTION private.reject_audit_log_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  PERFORM private.raise_business_error('AUDIT_LOG_IMMUTABLE');
  RETURN NULL;
END;
$$;

CREATE TRIGGER audit_log_reject_row_change
  BEFORE UPDATE OR DELETE ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION private.reject_audit_log_change();

CREATE TRIGGER audit_log_reject_truncate
  BEFORE TRUNCATE ON public.audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION private.reject_audit_log_change();

-- Informa actor, acción y motivo al trigger de auditoría. El alcance es la
-- transacción actual, por lo que debe llamarse dentro de la misma RPC que
-- ejecuta la escritura auditada. Si una RPC toca varias tablas auditadas,
-- debe volver a llamarla entre pasos para no reutilizar la acción.
CREATE OR REPLACE FUNCTION private.set_audit_context(
  p_actor_user_id uuid DEFAULT NULL,
  p_action text DEFAULT NULL,
  p_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  PERFORM set_config('app.audit_actor', coalesce(p_actor_user_id::text, ''), true);
  PERFORM set_config('app.audit_action', coalesce(p_action, ''), true);
  PERFORM set_config('app.audit_reason', coalesce(p_reason, ''), true);
END;
$$;

REVOKE ALL ON FUNCTION private.set_audit_context(uuid, text, text) FROM PUBLIC;

-- SECURITY DEFINER: el cliente no tiene permiso de INSERT sobre audit_log.
CREATE OR REPLACE FUNCTION private.audit_row_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_previous jsonb;
  v_new jsonb;
  v_record jsonb;
  v_actor uuid;
  v_action text;
BEGIN
  v_previous := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) END;
  v_new := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) END;

  IF TG_OP = 'UPDATE' AND v_previous = v_new THEN
    RETURN NULL;
  END IF;

  v_record := coalesce(v_new, v_previous);
  v_actor := coalesce(nullif(current_setting('app.audit_actor', true), '')::uuid, auth.uid());
  v_action := coalesce(
    nullif(current_setting('app.audit_action', true), ''),
    upper(TG_TABLE_NAME) || '_' || TG_OP
  );

  INSERT INTO public.audit_log (
    actor_user_id, action, entity_type, entity_id, previous_state, new_state, reason
  )
  VALUES (
    v_actor,
    v_action,
    TG_TABLE_NAME,
    -- role_permissions no tiene id propio: usa su clave compuesta
    coalesce(
      v_record ->> 'id',
      v_record ->> 'code',
      concat_ws(':', v_record ->> 'role_id', v_record ->> 'permission_code')
    ),
    v_previous,
    v_new,
    nullif(current_setting('app.audit_reason', true), '')
  );

  RETURN NULL;
END;
$$;

CREATE TRIGGER audit_territories
  AFTER INSERT OR UPDATE OR DELETE ON public.territories
  FOR EACH ROW EXECUTE FUNCTION private.audit_row_change();

CREATE TRIGGER audit_neighborhood_councils
  AFTER INSERT OR UPDATE OR DELETE ON public.neighborhood_councils
  FOR EACH ROW EXECUTE FUNCTION private.audit_row_change();

CREATE TRIGGER audit_roles
  AFTER INSERT OR UPDATE OR DELETE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION private.audit_row_change();

CREATE TRIGGER audit_role_permissions
  AFTER INSERT OR UPDATE OR DELETE ON public.role_permissions
  FOR EACH ROW EXECUTE FUNCTION private.audit_row_change();

CREATE TRIGGER audit_profiles
  AFTER INSERT OR UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION private.audit_row_change();

CREATE TRIGGER audit_campaigns
  AFTER INSERT OR UPDATE OR DELETE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION private.audit_row_change();

CREATE TRIGGER audit_inscriptions
  AFTER INSERT OR UPDATE OR DELETE ON public.inscriptions
  FOR EACH ROW EXECUTE FUNCTION private.audit_row_change();

CREATE TRIGGER audit_quality_cases
  AFTER INSERT OR UPDATE OR DELETE ON public.quality_cases
  FOR EACH ROW EXECUTE FUNCTION private.audit_row_change();

CREATE TRIGGER audit_deliveries
  AFTER INSERT OR UPDATE OR DELETE ON public.deliveries
  FOR EACH ROW EXECUTE FUNCTION private.audit_row_change();

-- Nunca hay DELETE físico sobre datos de negocio. role_permissions queda
-- fuera porque admin_set_role_permissions reemplaza las asignaciones.
CREATE TRIGGER territories_reject_delete
  BEFORE DELETE ON public.territories
  FOR EACH ROW EXECUTE FUNCTION private.reject_physical_delete();

CREATE TRIGGER neighborhood_councils_reject_delete
  BEFORE DELETE ON public.neighborhood_councils
  FOR EACH ROW EXECUTE FUNCTION private.reject_physical_delete();

CREATE TRIGGER roles_reject_delete
  BEFORE DELETE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION private.reject_physical_delete();

CREATE TRIGGER profiles_reject_delete
  BEFORE DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION private.reject_physical_delete();

CREATE TRIGGER campaigns_reject_delete
  BEFORE DELETE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION private.reject_physical_delete();

CREATE TRIGGER beneficiaries_reject_delete
  BEFORE DELETE ON public.beneficiaries
  FOR EACH ROW EXECUTE FUNCTION private.reject_physical_delete();

CREATE TRIGGER guardians_reject_delete
  BEFORE DELETE ON public.guardians
  FOR EACH ROW EXECUTE FUNCTION private.reject_physical_delete();

CREATE TRIGGER inscriptions_reject_delete
  BEFORE DELETE ON public.inscriptions
  FOR EACH ROW EXECUTE FUNCTION private.reject_physical_delete();

CREATE TRIGGER quality_cases_reject_delete
  BEFORE DELETE ON public.quality_cases
  FOR EACH ROW EXECUTE FUNCTION private.reject_physical_delete();

CREATE TRIGGER deliveries_reject_delete
  BEFORE DELETE ON public.deliveries
  FOR EACH ROW EXECUTE FUNCTION private.reject_physical_delete();
