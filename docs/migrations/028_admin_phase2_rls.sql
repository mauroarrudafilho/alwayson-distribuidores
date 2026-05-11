-- Fase 2 (administração global): escritas concedidas apenas a admins de tenant tipo admin_global.
-- Convites já tinham policy FOR ALL para admin em 018; faltava tenants/memberships/profiles.
--
-- Projeto canônico: osukbalwykbqvoumddxz

-- ─── alwayson_tenants ─────────────────────────────────────────────────────────

DROP POLICY IF EXISTS alwayson_tenants_admin_insert ON alwayson_tenants;
CREATE POLICY alwayson_tenants_admin_insert
  ON alwayson_tenants FOR INSERT TO authenticated
  WITH CHECK (public.current_user_is_admin());

DROP POLICY IF EXISTS alwayson_tenants_admin_update ON alwayson_tenants;
CREATE POLICY alwayson_tenants_admin_update
  ON alwayson_tenants FOR UPDATE TO authenticated
  USING (public.current_user_is_admin())
  WITH CHECK (public.current_user_is_admin());

-- ─── alwayson_memberships ──────────────────────────────────────────────────────

DROP POLICY IF EXISTS alwayson_memberships_admin_insert ON alwayson_memberships;
CREATE POLICY alwayson_memberships_admin_insert
  ON alwayson_memberships FOR INSERT TO authenticated
  WITH CHECK (public.current_user_is_admin());

DROP POLICY IF EXISTS alwayson_memberships_admin_update ON alwayson_memberships;
CREATE POLICY alwayson_memberships_admin_update
  ON alwayson_memberships FOR UPDATE TO authenticated
  USING (public.current_user_is_admin())
  WITH CHECK (public.current_user_is_admin());

DROP POLICY IF EXISTS alwayson_memberships_admin_delete ON alwayson_memberships;
CREATE POLICY alwayson_memberships_admin_delete
  ON alwayson_memberships FOR DELETE TO authenticated
  USING (public.current_user_is_admin());

-- ─── alwayson_user_profiles ────────────────────────────────────────────────────

DROP POLICY IF EXISTS alwayson_user_profiles_admin_update ON alwayson_user_profiles;
CREATE POLICY alwayson_user_profiles_admin_update
  ON alwayson_user_profiles FOR UPDATE TO authenticated
  USING (public.current_user_is_admin())
  WITH CHECK (public.current_user_is_admin());
