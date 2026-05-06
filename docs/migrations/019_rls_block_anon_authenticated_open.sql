-- RLS hardening (Fase 1): cortar leitura anônima de todas as tabelas alwayson_*
-- e abrir leitura/escrita básica para 'authenticated' (USING true).
-- Policies finas por tenant/role entram na Fase 2.
--
-- alwayson_insights_purge_config NÃO ganha policy: continua sem leitura via PostgREST,
-- só o RPC SECURITY DEFINER consegue acessá-la.
--
-- Projeto canônico: osukbalwykbqvoumddxz

-- ─── 1. Remover todas as policies '_anon' ───────────────────────────────────

DROP POLICY IF EXISTS alwayson_distribuidores_anon       ON alwayson_distribuidores;
DROP POLICY IF EXISTS alwayson_vendedores_anon           ON alwayson_vendedores_distribuidor;
DROP POLICY IF EXISTS alwayson_clientes_anon             ON alwayson_clientes_distribuidor;
DROP POLICY IF EXISTS alwayson_estoque_anon              ON alwayson_estoque_distribuidor;
DROP POLICY IF EXISTS alwayson_metas_anon                ON alwayson_metas_distribuidor;
DROP POLICY IF EXISTS alwayson_performance_anon          ON alwayson_performance_periodo;
DROP POLICY IF EXISTS alwayson_relatorios_anon           ON alwayson_relatorios_ingestao;
DROP POLICY IF EXISTS alwayson_excelencia_anon           ON alwayson_excelencia_criterios;
DROP POLICY IF EXISTS insights_uploads_select_anon       ON alwayson_insights_uploads;
DROP POLICY IF EXISTS insights_nf_select_anon            ON alwayson_insights_nf;
DROP POLICY IF EXISTS insights_itens_select_anon         ON alwayson_insights_nf_itens;
DROP POLICY IF EXISTS insights_clientes_select_anon      ON alwayson_insights_clientes;

-- ─── 2. Garantir RLS habilitado em todas as alwayson_* (idempotente) ────────

ALTER TABLE alwayson_distribuidor_produto_de_para ENABLE ROW LEVEL SECURITY;
ALTER TABLE alwayson_excelencia_clientes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE alwayson_excelencia_config            ENABLE ROW LEVEL SECURITY;
ALTER TABLE alwayson_faturamento                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE alwayson_faturamento_itens            ENABLE ROW LEVEL SECURITY;
ALTER TABLE alwayson_insights_produto_de_para     ENABLE ROW LEVEL SECURITY;
ALTER TABLE alwayson_insights_purge_config        ENABLE ROW LEVEL SECURITY;
ALTER TABLE alwayson_produtos                     ENABLE ROW LEVEL SECURITY;

-- ─── 3. Policies SELECT TO authenticated USING(true) (Fase 1 permissiva) ────

DO $$
DECLARE
  rec RECORD;
  tables_select text[] := ARRAY[
    'alwayson_distribuidores',
    'alwayson_vendedores_distribuidor',
    'alwayson_clientes_distribuidor',
    'alwayson_estoque_distribuidor',
    'alwayson_metas_distribuidor',
    'alwayson_performance_periodo',
    'alwayson_relatorios_ingestao',
    'alwayson_excelencia_criterios',
    'alwayson_excelencia_config',
    'alwayson_excelencia_clientes',
    'alwayson_produtos',
    'alwayson_faturamento',
    'alwayson_faturamento_itens',
    'alwayson_distribuidor_produto_de_para',
    'alwayson_insights_uploads',
    'alwayson_insights_nf',
    'alwayson_insights_nf_itens',
    'alwayson_insights_clientes',
    'alwayson_insights_produto_de_para'
  ];
  t text;
  pol_name text;
BEGIN
  FOREACH t IN ARRAY tables_select LOOP
    pol_name := t || '_select_authenticated';
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol_name, t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (true)',
      pol_name, t
    );
  END LOOP;
END$$;

-- ─── 4. Tabelas de-para: também precisam de INSERT/UPDATE/DELETE pela UI ────

DO $$
DECLARE
  tables_write text[] := ARRAY[
    'alwayson_distribuidor_produto_de_para',
    'alwayson_insights_produto_de_para'
  ];
  t text;
  pol_name text;
BEGIN
  FOREACH t IN ARRAY tables_write LOOP
    pol_name := t || '_write_authenticated';
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol_name, t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
      pol_name, t
    );
  END LOOP;
END$$;

COMMENT ON POLICY alwayson_distribuidor_produto_de_para_write_authenticated
  ON alwayson_distribuidor_produto_de_para IS
  'Fase 1 permissiva: qualquer authenticated. Restringir por tenant/role na Fase 2.';

COMMENT ON POLICY alwayson_insights_produto_de_para_write_authenticated
  ON alwayson_insights_produto_de_para IS
  'Fase 1 permissiva: qualquer authenticated. Restringir por tenant/role na Fase 2.';
