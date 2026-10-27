-- Exportación de la auditoría (CSV desde el portal).
-- La lectura sigue protegida por audit.read; esto agrega el permiso de exportar
-- y deja constancia en la propia auditoría de quién exportó, con qué filtros y cuántos registros.

INSERT INTO public.permissions (code, description) VALUES
  ('audit.export', 'Exportar el registro de auditoría a CSV');

INSERT INTO public.role_permissions (role_id, permission_code)
SELECT r.id, 'audit.export'
  FROM public.roles r
 WHERE r.code IN ('ADMIN', 'MUNICIPAL_OFFICER');

CREATE OR REPLACE FUNCTION public.register_audit_export(
  p_filters jsonb,
  p_row_count integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM private.require_permission('audit.export');

  IF p_row_count IS NULL OR p_row_count < 0
     OR (p_filters IS NOT NULL AND jsonb_typeof(p_filters) <> 'object') THEN
    PERFORM private.raise_business_error('VALIDATION_ERROR');
  END IF;

  -- audit_log no admite INSERT del cliente: esta función es la única vía
  INSERT INTO public.audit_log (actor_user_id, action, entity_type, new_state)
  VALUES (
    auth.uid(),
    'AUDIT_EXPORTED',
    'audit_log',
    jsonb_build_object('filters', coalesce(p_filters, '{}'::jsonb), 'row_count', p_row_count)
  );

  RETURN jsonb_build_object('row_count', p_row_count);
END;
$$;

REVOKE ALL ON FUNCTION public.register_audit_export(jsonb, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_audit_export(jsonb, integer) TO authenticated;
