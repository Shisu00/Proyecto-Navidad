-- Única vía para bajar must_change_password (SPECS §4.2, invariante 9).
-- Vive en public porque la Edge Function la invoca por PostgREST con service_role;
-- authenticated y anon no tienen EXECUTE, así que el cliente no puede llamarla.

CREATE OR REPLACE FUNCTION public.complete_password_change(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- auth.uid() es NULL con service_role: el actor auditado es el propio usuario
  PERFORM private.set_audit_context(p_user_id, 'PASSWORD_CHANGED');

  UPDATE public.profiles
     SET must_change_password = false,
         password_changed_at = now()
   WHERE id = p_user_id;

  IF NOT FOUND THEN
    PERFORM private.raise_business_error('NOT_FOUND');
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_password_change(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_password_change(uuid) TO service_role;
