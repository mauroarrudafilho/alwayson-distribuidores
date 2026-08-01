-- Cadastro de distribuidores pela UI admin (admin_global).
-- Antes 019 só abriu SELECT em alwayson_distribuidores; INSERT/UPDATE faltavam.
--
-- Projeto canônico: osukbalwykbqvoumddxz

DROP POLICY IF EXISTS alwayson_distribuidores_admin_insert ON alwayson_distribuidores;
CREATE POLICY alwayson_distribuidores_admin_insert
  ON alwayson_distribuidores FOR INSERT TO authenticated
  WITH CHECK (public.current_user_is_admin());

DROP POLICY IF EXISTS alwayson_distribuidores_admin_update ON alwayson_distribuidores;
CREATE POLICY alwayson_distribuidores_admin_update
  ON alwayson_distribuidores FOR UPDATE TO authenticated
  USING (public.current_user_is_admin())
  WITH CHECK (public.current_user_is_admin());

COMMENT ON POLICY alwayson_distribuidores_admin_insert ON alwayson_distribuidores IS
  'Admin global pode cadastrar distribuidores pela UI.';

COMMENT ON POLICY alwayson_distribuidores_admin_update ON alwayson_distribuidores IS
  'Admin global pode atualizar cadastro de distribuidores.';
