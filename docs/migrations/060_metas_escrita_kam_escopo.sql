-- Migration 060 — metas: escrita no recorte visível (KAM / gestor fornecedor).
--
-- Até aqui INSERT/UPDATE/DELETE em alwayson_metas_distribuidor exigiam
-- current_user_is_admin(). KAM e gestor do fornecedor enxergam metas pela
-- policy de SELECT da 048, mas não conseguiam gravar.
--
-- Regra alinhada ao SELECT de dois eixos (048):
--   admin OR (distribuidor ∈ visíveis AND fornecedor ∈ visíveis)
--
-- Projeto canônico: osukbalwykbqvoumddxz

CREATE OR REPLACE FUNCTION public.current_user_metas_escopo_ok(
  p_distribuidor_id uuid,
  p_fornecedor_tenant_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.current_user_is_admin()
    OR (
      p_distribuidor_id IN (
        SELECT d.distribuidor_id FROM public.current_user_distribuidores_visiveis() d
      )
      AND p_fornecedor_tenant_id IN (
        SELECT f.tenant_id FROM public.current_user_fornecedores_visiveis() f
      )
    );
$$;

COMMENT ON FUNCTION public.current_user_metas_escopo_ok(uuid, uuid) IS
  'Autoriza escrita de meta quando o par distribuidor+fornecedor está no recorte do utilizador (mesmo predicado do SELECT da 048).';

REVOKE ALL ON FUNCTION public.current_user_metas_escopo_ok(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_metas_escopo_ok(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS alwayson_metas_distribuidor_admin_insert ON alwayson_metas_distribuidor;
DROP POLICY IF EXISTS alwayson_metas_distribuidor_admin_update ON alwayson_metas_distribuidor;
DROP POLICY IF EXISTS alwayson_metas_distribuidor_admin_delete ON alwayson_metas_distribuidor;

CREATE POLICY alwayson_metas_distribuidor_insert_escopo
  ON alwayson_metas_distribuidor
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.current_user_metas_escopo_ok(distribuidor_id, fornecedor_tenant_id)
  );

CREATE POLICY alwayson_metas_distribuidor_update_escopo
  ON alwayson_metas_distribuidor
  FOR UPDATE
  TO authenticated
  USING (
    public.current_user_metas_escopo_ok(distribuidor_id, fornecedor_tenant_id)
  )
  WITH CHECK (
    public.current_user_metas_escopo_ok(distribuidor_id, fornecedor_tenant_id)
  );

CREATE POLICY alwayson_metas_distribuidor_delete_escopo
  ON alwayson_metas_distribuidor
  FOR DELETE
  TO authenticated
  USING (
    public.current_user_metas_escopo_ok(distribuidor_id, fornecedor_tenant_id)
  );
