-- RLS y privilegios (SPECS §4.5).
-- Solo hay políticas SELECT: INSERT, UPDATE y DELETE directos quedan negados.
-- Toda escritura de negocio pasa por RPC SECURITY DEFINER.
-- (SELECT ...) alrededor de los helpers permite que Postgres los evalúe una
-- sola vez por consulta en lugar de una por fila.

ALTER TABLE public.territories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.neighborhood_councils ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beneficiaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guardians ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quality_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quality_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Catálogos: lectura para usuario activo
CREATE POLICY territories_select ON public.territories
  FOR SELECT TO authenticated
  USING ((SELECT private.is_active_user()));

CREATE POLICY neighborhood_councils_select ON public.neighborhood_councils
  FOR SELECT TO authenticated
  USING ((SELECT private.is_active_user()));

CREATE POLICY campaigns_select ON public.campaigns
  FOR SELECT TO authenticated
  USING ((SELECT private.is_active_user()));

-- Roles y permisos: los necesitan el editor de roles y el alta de cuentas
CREATE POLICY roles_select ON public.roles
  FOR SELECT TO authenticated
  USING (
    (SELECT private.has_permission('role.manage'))
    OR (SELECT private.has_permission('user.manage'))
    OR (SELECT private.has_permission('user.read'))
  );

CREATE POLICY permissions_select ON public.permissions
  FOR SELECT TO authenticated
  USING (
    (SELECT private.has_permission('role.manage'))
    OR (SELECT private.has_permission('user.manage'))
    OR (SELECT private.has_permission('user.read'))
  );

CREATE POLICY role_permissions_select ON public.role_permissions
  FOR SELECT TO authenticated
  USING (
    (SELECT private.has_permission('role.manage'))
    OR (SELECT private.has_permission('user.manage'))
    OR (SELECT private.has_permission('user.read'))
  );

-- La fila propia se lee siempre, incluso con clave temporal pendiente
CREATE POLICY profiles_select ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = (SELECT auth.uid())
    OR (SELECT private.has_permission('user.read'))
  );

CREATE POLICY inscriptions_select ON public.inscriptions
  FOR SELECT TO authenticated
  USING (
    (SELECT private.has_permission('inscription.read_all'))
    OR (
      (SELECT private.has_permission('inscription.read_own_council'))
      AND council_id = (SELECT private.current_council_id())
    )
  );

-- beneficiaries y guardians no tienen JJVV propia: heredan la visibilidad
-- de las inscripciones que el usuario puede ver (RLS de inscriptions aplica
-- dentro del EXISTS).
CREATE POLICY beneficiaries_select ON public.beneficiaries
  FOR SELECT TO authenticated
  USING (
    (SELECT private.has_permission('inscription.read_all'))
    OR EXISTS (
      SELECT 1
        FROM public.inscriptions i
       WHERE i.beneficiary_id = beneficiaries.id
    )
  );

CREATE POLICY guardians_select ON public.guardians
  FOR SELECT TO authenticated
  USING (
    (SELECT private.has_permission('inscription.read_all'))
    OR EXISTS (
      SELECT 1
        FROM public.inscriptions i
       WHERE i.guardian_id = guardians.id
    )
  );

-- La suscripción Realtime respeta esta política
CREATE POLICY deliveries_select ON public.deliveries
  FOR SELECT TO authenticated
  USING (
    (SELECT private.has_permission('delivery.read_all'))
    OR (
      (SELECT private.has_permission('delivery.read_own_council'))
      AND council_id = (SELECT private.current_council_id())
    )
  );

CREATE POLICY quality_rules_select ON public.quality_rules
  FOR SELECT TO authenticated
  USING ((SELECT private.has_permission('quality.read')));

CREATE POLICY quality_cases_select ON public.quality_cases
  FOR SELECT TO authenticated
  USING ((SELECT private.has_permission('quality.read')));

CREATE POLICY audit_log_select ON public.audit_log
  FOR SELECT TO authenticated
  USING ((SELECT private.has_permission('audit.read')));

-- Defensa en profundidad: aunque falte una política, estos roles no
-- tienen privilegio de escritura. Supabase concede ALL por defecto.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

GRANT SELECT ON
  public.territories,
  public.neighborhood_councils,
  public.roles,
  public.permissions,
  public.role_permissions,
  public.profiles,
  public.campaigns,
  public.beneficiaries,
  public.guardians,
  public.inscriptions,
  public.quality_rules,
  public.quality_cases,
  public.deliveries,
  public.audit_log
TO authenticated;

-- Las tablas futuras tampoco quedan abiertas por defecto
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
