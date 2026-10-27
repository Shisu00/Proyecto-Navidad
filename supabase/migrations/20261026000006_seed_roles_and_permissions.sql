-- Catálogo de permisos y roles de sistema (SPECS §4.4).
-- Va en una migración y no en seed.sql porque producción no ejecuta seed.
-- Los nombres y descripciones son datos visibles en el editor de roles.

INSERT INTO public.permissions (code, description) VALUES
  ('inscription.create', 'Crear inscripciones'),
  ('inscription.update_own', 'Editar inscripciones propias mientras estén pendientes'),
  ('inscription.read_own_council', 'Ver inscripciones de su propia JJVV'),
  ('inscription.read_all', 'Ver todas las inscripciones'),
  ('inscription.review', 'Validar, observar o descartar inscripciones'),
  ('delivery.confirm', 'Registrar entregas de su propia JJVV'),
  ('delivery.void', 'Anular entregas de su propia JJVV'),
  ('delivery.read_own_council', 'Ver entregas de su propia JJVV'),
  ('delivery.read_all', 'Ver todas las entregas'),
  ('planning.read', 'Ver planificación, avance y proyección de compras'),
  ('quality.read', 'Ver reglas y casos de calidad'),
  ('audit.read', 'Ver el registro de auditoría'),
  ('user.read', 'Ver cuentas de usuario'),
  ('user.manage', 'Crear, desactivar y reiniciar clave de cuentas territoriales'),
  ('catalog.manage', 'Gestionar territorios, JJVV y campañas'),
  ('role.manage', 'Gestionar roles y permisos');

-- DELIVERY_OPERATOR queda retirado (inactivo y sin permisos) solo para
-- conservar las referencias históricas.
INSERT INTO public.roles (code, name, is_system, is_active, requires_council) VALUES
  ('ADMIN', 'Administrador', true, true, false),
  ('MUNICIPAL_OFFICER', 'Funcionario municipal', true, true, false),
  ('NEIGHBORHOOD_USER', 'Funcionario JJVV', true, true, true),
  ('DELIVERY_OPERATOR', 'Operador de entrega (retirado)', true, false, true);

-- ADMIN recibe todo el catálogo
INSERT INTO public.role_permissions (role_id, permission_code)
SELECT r.id, p.code
  FROM public.roles r
 CROSS JOIN public.permissions p
 WHERE r.code = 'ADMIN';

INSERT INTO public.role_permissions (role_id, permission_code)
SELECT r.id, grants.permission_code
  FROM (VALUES
    ('MUNICIPAL_OFFICER', 'inscription.read_all'),
    ('MUNICIPAL_OFFICER', 'inscription.review'),
    ('MUNICIPAL_OFFICER', 'delivery.read_all'),
    ('MUNICIPAL_OFFICER', 'planning.read'),
    ('MUNICIPAL_OFFICER', 'quality.read'),
    ('MUNICIPAL_OFFICER', 'audit.read'),
    ('MUNICIPAL_OFFICER', 'user.read'),
    ('MUNICIPAL_OFFICER', 'user.manage'),
    ('NEIGHBORHOOD_USER', 'inscription.create'),
    ('NEIGHBORHOOD_USER', 'inscription.update_own'),
    ('NEIGHBORHOOD_USER', 'inscription.read_own_council'),
    ('NEIGHBORHOOD_USER', 'delivery.confirm'),
    ('NEIGHBORHOOD_USER', 'delivery.void'),
    ('NEIGHBORHOOD_USER', 'delivery.read_own_council')
  ) AS grants (role_code, permission_code)
  JOIN public.roles r ON r.code = grants.role_code;
