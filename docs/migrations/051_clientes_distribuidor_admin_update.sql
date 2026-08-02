-- Migration 051 — escrita administrativa em `alwayson_clientes_distribuidor`.
--
-- A tabela só tinha policy de SELECT: por convenção, as tabelas centrais de
-- negócio são escritas apenas pelo `service_role` (ingestão), para a aplicação
-- não corromper dado importado. Isso vale para o que **vem do arquivo** —
-- razão social, CNPJ, faturamento.
--
-- A atribuição de vendedor é outra coisa: é **correção de cadastro**, feita por
-- quem administra, e é o que permite remanejar um cliente entre vendedores sem
-- reprocessar planilha. Sem esta policy o UPDATE não dá erro — o PostgREST
-- devolve 0 linhas afetadas e a tela mente dizendo que gravou.
--
-- Mesmo padrão administrativo das migrations 028/035/044/045.
--
-- Projeto canônico: osukbalwykbqvoumddxz

DROP POLICY IF EXISTS alwayson_clientes_distribuidor_admin_update
  ON alwayson_clientes_distribuidor;
CREATE POLICY alwayson_clientes_distribuidor_admin_update
  ON alwayson_clientes_distribuidor FOR UPDATE TO authenticated
  USING (public.current_user_is_admin())
  WITH CHECK (public.current_user_is_admin());

COMMENT ON POLICY alwayson_clientes_distribuidor_admin_update
  ON alwayson_clientes_distribuidor IS
  'Correção de cadastro pelo admin (principal caso: remanejar cliente entre vendedores). A carga em massa continua pelo template `clientes` via service_role.';
