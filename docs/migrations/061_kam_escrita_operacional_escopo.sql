-- Migration 061 — escrita operacional no recorte do KAM / gestor fornecedor.
--
-- O KAM é gestor da ferramenta no dia a dia (metas, parceiros, cadastro,
-- clientes estratégicos) — não administra a plataforma (/admin).
-- Estende as policies que eram só `current_user_is_admin()` para o mesmo
-- recorte de distribuidor já usado no SELECT (migration 048).
--
-- Projeto canônico: osukbalwykbqvoumddxz

CREATE OR REPLACE FUNCTION public.current_user_distribuidor_escopo_ok(p_distribuidor_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.current_user_is_admin()
    OR p_distribuidor_id IN (
      SELECT d.distribuidor_id FROM public.current_user_distribuidores_visiveis() d
    );
$$;

CREATE OR REPLACE FUNCTION public.current_user_cliente_escopo_ok(p_cliente_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.current_user_is_admin()
    OR EXISTS (
      SELECT 1
      FROM alwayson_clientes_distribuidor c
      WHERE c.id = p_cliente_id
        AND c.distribuidor_id IN (
          SELECT d.distribuidor_id FROM public.current_user_distribuidores_visiveis() d
        )
    );
$$;

COMMENT ON FUNCTION public.current_user_distribuidor_escopo_ok(uuid) IS
  'Autoriza operação no distribuidor quando pertence ao recorte visível do utilizador.';

COMMENT ON FUNCTION public.current_user_cliente_escopo_ok(uuid) IS
  'Autoriza operação no cliente quando o distribuidor dele está no recorte visível.';

REVOKE ALL ON FUNCTION public.current_user_distribuidor_escopo_ok(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_user_cliente_escopo_ok(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_distribuidor_escopo_ok(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_cliente_escopo_ok(uuid) TO authenticated;

-- Clientes: remanejo entre vendedores (migration 051)
DROP POLICY IF EXISTS alwayson_clientes_distribuidor_admin_update ON alwayson_clientes_distribuidor;
CREATE POLICY alwayson_clientes_distribuidor_update_escopo
  ON alwayson_clientes_distribuidor
  FOR UPDATE
  TO authenticated
  USING (public.current_user_distribuidor_escopo_ok(distribuidor_id))
  WITH CHECK (public.current_user_distribuidor_escopo_ok(distribuidor_id));

-- Ajustes de cadastro (migration 044)
DROP POLICY IF EXISTS alwayson_clientes_ajustes_cadastro_admin_insert ON alwayson_clientes_ajustes_cadastro;
DROP POLICY IF EXISTS alwayson_clientes_ajustes_cadastro_admin_update ON alwayson_clientes_ajustes_cadastro;

CREATE POLICY alwayson_clientes_ajustes_cadastro_insert_escopo
  ON alwayson_clientes_ajustes_cadastro
  FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_cliente_escopo_ok(cliente_id));

CREATE POLICY alwayson_clientes_ajustes_cadastro_update_escopo
  ON alwayson_clientes_ajustes_cadastro
  FOR UPDATE
  TO authenticated
  USING (public.current_user_cliente_escopo_ok(cliente_id))
  WITH CHECK (public.current_user_cliente_escopo_ok(cliente_id));

-- Área de atuação / cidades (migration 046)
DROP POLICY IF EXISTS alwayson_distribuidor_cidades_admin_insert ON alwayson_distribuidor_cidades;
DROP POLICY IF EXISTS alwayson_distribuidor_cidades_admin_delete ON alwayson_distribuidor_cidades;

CREATE POLICY alwayson_distribuidor_cidades_insert_escopo
  ON alwayson_distribuidor_cidades
  FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_distribuidor_escopo_ok(distribuidor_id));

CREATE POLICY alwayson_distribuidor_cidades_delete_escopo
  ON alwayson_distribuidor_cidades
  FOR DELETE
  TO authenticated
  USING (public.current_user_distribuidor_escopo_ok(distribuidor_id));

-- Clientes estratégicos (migration 052)
DROP POLICY IF EXISTS alwayson_clientes_estrategicos_insert_admin ON alwayson_clientes_estrategicos;
DROP POLICY IF EXISTS alwayson_clientes_estrategicos_update_admin ON alwayson_clientes_estrategicos;
DROP POLICY IF EXISTS alwayson_clientes_estrategicos_delete_admin ON alwayson_clientes_estrategicos;

CREATE POLICY alwayson_clientes_estrategicos_insert_escopo
  ON alwayson_clientes_estrategicos
  FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_distribuidor_escopo_ok(distribuidor_id));

CREATE POLICY alwayson_clientes_estrategicos_update_escopo
  ON alwayson_clientes_estrategicos
  FOR UPDATE
  TO authenticated
  USING (public.current_user_distribuidor_escopo_ok(distribuidor_id))
  WITH CHECK (public.current_user_distribuidor_escopo_ok(distribuidor_id));

CREATE POLICY alwayson_clientes_estrategicos_delete_escopo
  ON alwayson_clientes_estrategicos
  FOR DELETE
  TO authenticated
  USING (public.current_user_distribuidor_escopo_ok(distribuidor_id));

DROP POLICY IF EXISTS alwayson_clientes_estrategicos_config_write_admin ON alwayson_clientes_estrategicos_config;
CREATE POLICY alwayson_clientes_estrategicos_config_write_escopo
  ON alwayson_clientes_estrategicos_config
  FOR ALL
  TO authenticated
  USING (public.current_user_distribuidor_escopo_ok(distribuidor_id))
  WITH CHECK (public.current_user_distribuidor_escopo_ok(distribuidor_id));
