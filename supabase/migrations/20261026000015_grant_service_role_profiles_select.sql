-- La migración 09 revoca privilegios por defecto; en algunos proyectos service_role
-- quedó sin acceso. change-password lee profiles con esta clave (SPECS §4.3).
-- Solo SELECT: las escrituras pasan por RPC SECURITY DEFINER.

GRANT SELECT ON public.profiles TO service_role;
