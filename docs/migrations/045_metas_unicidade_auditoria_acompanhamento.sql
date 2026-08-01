-- Migration 045 — metas: unicidade, auditoria e acompanhamento derivado.
--
-- Prepara `alwayson_metas_distribuidor` para receber carga real (planilha ou
-- criação pela UI) resolvendo três problemas:
--
--   1. Sem UNIQUE, re-subir a mesma meta duplicava (diferente do faturamento,
--      onde reprocessar substitui). Índices parciais dão a chave natural e
--      permitem UPSERT idempotente.
--   2. `valor_realizado` / `percentual_atingimento` eram colunas GRAVADAS —
--      ficariam obsoletas assim que um novo arquivo de vendas entrasse. Passam
--      a ser DERIVADAS na view, com os mesmos nomes, para os leitores atuais
--      só trocarem a origem.
--   3. Meta agora carrega justificativa e autoria — o número é construído com
--      apoio do histórico e precisa ser rastreável.
--
-- Modelagem do rollup: a meta de supervisor/gerente NÃO é a soma dos filhos.
-- É **rollup editável** — a soma é sugestão, o valor definido é a autoridade,
-- e a diferença entre os dois é justamente a venda direta daquele nível (um
-- supervisor pode vender sem passar por vendedor). A view expõe os dois lados
-- (`valor_rollup_filhos`, `diferenca_rollup`) para a UI mostrar a folga.
--
-- Projeto canônico: osukbalwykbqvoumddxz

-- ─── 1. Chave natural / idempotência ────────────────────────────────────────
-- Duas chaves porque a meta de distribuidor não tem vendedor_id.

CREATE UNIQUE INDEX IF NOT EXISTS uq_metas_vendedor_tipo_periodo
  ON alwayson_metas_distribuidor (vendedor_id, tipo, periodo_inicio, periodo_fim)
  WHERE vendedor_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_metas_distribuidor_tipo_periodo
  ON alwayson_metas_distribuidor (distribuidor_id, tipo, periodo_inicio, periodo_fim)
  WHERE vendedor_id IS NULL;

-- ⚠️ São índices PARCIAIS: `ON CONFLICT` precisa repetir o predicado para
-- inferir o índice, senão o Postgres devolve 42P10. Na importação em SQL use:
--
--   INSERT INTO alwayson_metas_distribuidor (...) VALUES (...)
--   ON CONFLICT (vendedor_id, tipo, periodo_inicio, periodo_fim)
--     WHERE vendedor_id IS NOT NULL
--   DO UPDATE SET valor_meta = EXCLUDED.valor_meta;
--
-- O cliente supabase-js não expressa esse predicado em `.upsert()`, por isso
-- o hook do front usa select→update/insert (mesmo padrão de useInsightsAcoes).

-- FK sem índice de cobertura (apontado pelo advisor de performance).
CREATE INDEX IF NOT EXISTS idx_metas_vendedor
  ON alwayson_metas_distribuidor (vendedor_id);

-- ─── 2. Auditoria e justificativa ───────────────────────────────────────────

ALTER TABLE alwayson_metas_distribuidor
  ADD COLUMN IF NOT EXISTS observacao     text,
  ADD COLUMN IF NOT EXISTS criado_por     uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS atualizado_por uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS atualizado_em  timestamptz NOT NULL DEFAULT now();

COMMENT ON COLUMN alwayson_metas_distribuidor.observacao IS
  'Justificativa da meta (base histórica usada, premissa comercial, ajuste combinado).';

CREATE OR REPLACE FUNCTION public.fn_alwayson_metas_touch()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.atualizado_em := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_alwayson_metas_touch ON alwayson_metas_distribuidor;
CREATE TRIGGER trg_alwayson_metas_touch
BEFORE UPDATE ON alwayson_metas_distribuidor
FOR EACH ROW EXECUTE FUNCTION public.fn_alwayson_metas_touch();

-- ─── 3. Realizado deixa de ser gravado ──────────────────────────────────────
-- Seguro: a tabela está vazia (0 linhas) no momento desta migration. Os mesmos
-- nomes reaparecem na view abaixo, já calculados.

ALTER TABLE alwayson_metas_distribuidor
  DROP COLUMN IF EXISTS valor_realizado,
  DROP COLUMN IF EXISTS percentual_atingimento;

-- ─── 4. View de acompanhamento ──────────────────────────────────────────────
-- security_invoker: respeita a RLS de quem consulta (não repete o problema das
-- views SECURITY DEFINER do Insights, apontadas como ERROR pelo linter).

DROP VIEW IF EXISTS alwayson_metas_v_acompanhamento;
CREATE VIEW alwayson_metas_v_acompanhamento
WITH (security_invoker = true) AS
WITH RECURSIVE subordinacao AS (
  -- Todo nó é membro de si mesmo…
  SELECT id AS raiz_id, id AS membro_id
  FROM alwayson_vendedores_distribuidor
  UNION ALL
  -- …e herda quem está abaixo dele (vendedor → supervisor → gerente).
  SELECT s.raiz_id, v.id
  FROM subordinacao s
  JOIN alwayson_vendedores_distribuidor v ON v.supervisor_id = s.membro_id
)
SELECT
  m.id,
  m.distribuidor_id,
  m.vendedor_id,
  m.hierarquia,
  m.tipo,
  m.periodo_inicio,
  m.periodo_fim,
  m.valor_meta,
  m.observacao,
  m.criado_por,
  m.criado_em,
  m.atualizado_por,
  m.atualizado_em,

  -- Realizado derivado do faturamento, conforme o tipo da meta.
  -- `clientes_excelencia` fica NULL: depende de alwayson_excelencia_clientes,
  -- ainda sem carga e sem UI de cadastro.
  CASE m.tipo
    WHEN 'faturamento' THEN fat.total_faturado
    WHEN 'positivacao' THEN fat.clientes_positivados::numeric
    WHEN 'mix'         THEN mix.skus_distintos::numeric
    ELSE NULL
  END AS valor_realizado,

  CASE
    WHEN m.valor_meta IS NULL OR m.valor_meta = 0 THEN NULL
    ELSE round(
      100.0 * COALESCE(
        CASE m.tipo
          WHEN 'faturamento' THEN fat.total_faturado
          WHEN 'positivacao' THEN fat.clientes_positivados::numeric
          WHEN 'mix'         THEN mix.skus_distintos::numeric
          ELSE NULL
        END, 0) / m.valor_meta, 2)
  END AS percentual_atingimento,

  -- Soma das metas dos filhos diretos, mesma métrica e mesmo período.
  -- É a *sugestão* de rollup — não substitui o valor definido.
  rollup.valor_rollup_filhos,
  rollup.qtd_filhos_com_meta,

  -- Diferença = parcela não coberta pelos filhos. Num supervisor/gerente,
  -- é a meta de venda direta dele. Negativo = filhos somam mais que o nível.
  CASE
    WHEN rollup.valor_rollup_filhos IS NULL THEN NULL
    ELSE m.valor_meta - rollup.valor_rollup_filhos
  END AS diferenca_rollup

FROM alwayson_metas_distribuidor m

-- Faturamento e positivação: uma passada, sem join de itens (evita
-- multiplicar linhas e inflar o SUM).
LEFT JOIN LATERAL (
  SELECT
    COALESCE(SUM(f.valor_total), 0) AS total_faturado,
    COUNT(DISTINCT f.cliente_id)    AS clientes_positivados
  FROM alwayson_faturamento f
  WHERE f.data_emissao BETWEEN m.periodo_inicio AND m.periodo_fim
    AND (
      (m.vendedor_id IS NULL AND f.distribuidor_id = m.distribuidor_id)
      OR (m.vendedor_id IS NOT NULL AND f.vendedor_id IN (
            SELECT s.membro_id FROM subordinacao s WHERE s.raiz_id = m.vendedor_id))
    )
) fat ON true

-- Mix: precisa dos itens, então vive em sua própria passada.
LEFT JOIN LATERAL (
  SELECT COUNT(DISTINCT it.sku) AS skus_distintos
  FROM alwayson_faturamento f
  JOIN alwayson_faturamento_itens it ON it.faturamento_id = f.id
  WHERE f.data_emissao BETWEEN m.periodo_inicio AND m.periodo_fim
    AND (
      (m.vendedor_id IS NULL AND f.distribuidor_id = m.distribuidor_id)
      OR (m.vendedor_id IS NOT NULL AND f.vendedor_id IN (
            SELECT s.membro_id FROM subordinacao s WHERE s.raiz_id = m.vendedor_id))
    )
) mix ON true

-- Rollup dos filhos diretos (um nível abaixo apenas).
LEFT JOIN LATERAL (
  SELECT
    SUM(mf.valor_meta) AS valor_rollup_filhos,
    count(*)           AS qtd_filhos_com_meta
  FROM alwayson_metas_distribuidor mf
  JOIN alwayson_vendedores_distribuidor vf ON vf.id = mf.vendedor_id
  WHERE mf.tipo           = m.tipo
    AND mf.periodo_inicio = m.periodo_inicio
    AND mf.periodo_fim    = m.periodo_fim
    AND (
      -- filhos de um supervisor/gerente
      (m.vendedor_id IS NOT NULL AND vf.supervisor_id = m.vendedor_id)
      -- filhos da meta do distribuidor = topo da árvore (gerentes)
      OR (m.vendedor_id IS NULL
          AND vf.distribuidor_id = m.distribuidor_id
          AND vf.supervisor_id IS NULL)
    )
) rollup ON true;

COMMENT ON VIEW alwayson_metas_v_acompanhamento IS
  'Metas com realizado derivado do faturamento (nunca gravado) e comparação com o rollup dos filhos diretos. diferenca_rollup = parcela de venda direta do nível.';

-- ─── 5. RLS de escrita ──────────────────────────────────────────────────────
-- Leitura já liberada a authenticated (policy existente). Escrita segue o
-- padrão administrativo das migrations 028/035/044.

DROP POLICY IF EXISTS alwayson_metas_distribuidor_admin_insert ON alwayson_metas_distribuidor;
CREATE POLICY alwayson_metas_distribuidor_admin_insert
  ON alwayson_metas_distribuidor FOR INSERT TO authenticated
  WITH CHECK (public.current_user_is_admin());

DROP POLICY IF EXISTS alwayson_metas_distribuidor_admin_update ON alwayson_metas_distribuidor;
CREATE POLICY alwayson_metas_distribuidor_admin_update
  ON alwayson_metas_distribuidor FOR UPDATE TO authenticated
  USING (public.current_user_is_admin())
  WITH CHECK (public.current_user_is_admin());

DROP POLICY IF EXISTS alwayson_metas_distribuidor_admin_delete ON alwayson_metas_distribuidor;
CREATE POLICY alwayson_metas_distribuidor_admin_delete
  ON alwayson_metas_distribuidor FOR DELETE TO authenticated
  USING (public.current_user_is_admin());
