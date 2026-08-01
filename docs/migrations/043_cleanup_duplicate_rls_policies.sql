-- Migration 043 — remove policies de RLS duplicadas (leftover do clone de schema
-- `alwayson_clone_schema_and_rls_from_kgzy_may2026`, que conviveu com a convenção
-- de nomes atual). Todas as policies removidas aqui são literalmente idênticas
-- à policy irmã que permanece (mesmo cmd, mesma role `authenticated`, mesmo
-- `USING (true)`) — dropar uma delas não muda nenhum acesso, só remove o custo
-- de o Postgres avaliar duas policies permissivas na mesma query.
--
-- Confirmado via `SELECT * FROM pg_policies` antes de escrever este arquivo —
-- nenhuma das policies removidas tem qualificador diferente da que fica.
--
-- Projeto canônico: osukbalwykbqvoumddxz

DROP POLICY IF EXISTS alwayson_clientes_select        ON alwayson_clientes_distribuidor;
DROP POLICY IF EXISTS alwayson_distribuidores_select   ON alwayson_distribuidores;
DROP POLICY IF EXISTS alwayson_estoque_select          ON alwayson_estoque_distribuidor;
DROP POLICY IF EXISTS alwayson_excelencia_select       ON alwayson_excelencia_criterios;
DROP POLICY IF EXISTS insights_clientes_select_authenticated ON alwayson_insights_clientes;
DROP POLICY IF EXISTS insights_nf_select_auth          ON alwayson_insights_nf;
DROP POLICY IF EXISTS insights_itens_select_auth       ON alwayson_insights_nf_itens;
DROP POLICY IF EXISTS insights_uploads_select_auth     ON alwayson_insights_uploads;
DROP POLICY IF EXISTS alwayson_metas_select            ON alwayson_metas_distribuidor;
DROP POLICY IF EXISTS alwayson_performance_select      ON alwayson_performance_periodo;
DROP POLICY IF EXISTS alwayson_relatorios_select       ON alwayson_relatorios_ingestao;
DROP POLICY IF EXISTS alwayson_vendedores_select       ON alwayson_vendedores_distribuidor;

-- Nota: NÃO mexemos em `alwayson_user_profiles_admin_update` +
-- `alwayson_user_profiles_self_update` — o advisor aponta as duas como
-- "multiple permissive policies", mas são logicamente distintas (self vs.
-- admin), não um duplicado acidental. Mesclar as duas em uma única policy
-- com OR é uma otimização válida, mas fora do escopo desta limpeza.
--
-- Nota 2: as duas policies `..._write_authenticated` com `USING (true) WITH
-- CHECK (true)` em `alwayson_distribuidor_produto_de_para` e
-- `alwayson_insights_produto_de_para` NÃO são duplicadas — são a única policy
-- de escrita daquelas tabelas. O advisor de segurança as marca como
-- permissivas demais (`rls_policy_always_true`); ficou registrado como dívida
-- técnica separada, não tratado aqui.
