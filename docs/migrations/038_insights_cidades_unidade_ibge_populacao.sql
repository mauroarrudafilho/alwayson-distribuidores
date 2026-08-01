-- Migration 038 — unidade predominante / litros por cidade + cache IBGE população municipal.
-- Depende: 015_insights_clientes_dim.sql (view v_cidades com dimensão cliente).

-- ─── Cache população IBGE (estimativa 2022) ───────────────────────────────────

CREATE TABLE IF NOT EXISTS alwayson_ibge_municipio_populacao (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cidade_norm     text NOT NULL,
  estado          char(2) NOT NULL,
  cidade_exibicao text,
  codigo_ibge     integer,
  populacao       integer NOT NULL CHECK (populacao > 0),
  ano_referencia  integer NOT NULL DEFAULT 2022,
  sincronizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT alwayson_ibge_municipio_populacao_uq
    UNIQUE (cidade_norm, estado, ano_referencia)
);

CREATE INDEX IF NOT EXISTS idx_ibge_pop_cidade_estado
  ON alwayson_ibge_municipio_populacao (estado, cidade_norm);

COMMENT ON TABLE alwayson_ibge_municipio_populacao IS
  'População municipal IBGE (Censo 2022 / agregado 4714). Preenchida via scripts/sync-ibge-populacao.mjs.';

ALTER TABLE alwayson_ibge_municipio_populacao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ibge_pop_select_anon ON alwayson_ibge_municipio_populacao;
CREATE POLICY ibge_pop_select_anon
  ON alwayson_ibge_municipio_populacao FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS ibge_pop_select_auth ON alwayson_ibge_municipio_populacao;
CREATE POLICY ibge_pop_select_auth
  ON alwayson_ibge_municipio_populacao FOR SELECT TO authenticated USING (true);

GRANT SELECT ON alwayson_ibge_municipio_populacao TO anon, authenticated;

-- ─── View cidades: unidade predominante + volume em litros ────────────────────

DROP VIEW IF EXISTS alwayson_insights_v_cidades CASCADE;

CREATE VIEW alwayson_insights_v_cidades AS
WITH base AS (
  SELECT
    COALESCE(ic.cidade, '— sem cidade —') AS cidade,
    COALESCE(ic.estado, '—')              AS estado,
    nf.id                                 AS nf_id,
    nf.cnpj_cliente,
    itens.sku,
    itens.quantidade,
    itens.valor_total,
    UPPER(TRIM(COALESCE(itens.unidade, ''))) AS unidade_norm
  FROM alwayson_insights_nf nf
  JOIN alwayson_insights_clientes ic ON ic.cnpj_14 = nf.cnpj_cliente
  LEFT JOIN alwayson_insights_nf_itens itens ON itens.nf_id = nf.id
),
cidade_agg AS (
  SELECT
    cidade,
    estado,
    COALESCE(SUM(valor_total), 0)              AS faturamento_total,
    COUNT(DISTINCT nf_id)                      AS total_nfs,
    COUNT(DISTINCT cnpj_cliente)               AS total_clientes,
    COUNT(DISTINCT sku)                        AS total_skus,
    COALESCE(SUM(quantidade), 0)               AS quantidade_total,
    COALESCE(SUM(quantidade) FILTER (
      WHERE unidade_norm IN ('L', 'LT', 'LITRO', 'LITROS', 'LTR')
    ), 0)                                      AS quantidade_litros
  FROM base
  GROUP BY cidade, estado
),
unidade_por_cidade AS (
  SELECT DISTINCT ON (cidade, estado)
    cidade,
    estado,
    unidade_norm AS unidade_predominante
  FROM (
    SELECT
      cidade,
      estado,
      unidade_norm,
      SUM(COALESCE(quantidade, 0)) AS qtd_unidade
    FROM base
    WHERE unidade_norm <> ''
    GROUP BY cidade, estado, unidade_norm
  ) u
  ORDER BY cidade, estado, qtd_unidade DESC, unidade_norm
)
SELECT
  a.cidade,
  a.estado,
  a.faturamento_total,
  a.total_nfs,
  a.total_clientes,
  CASE
    WHEN a.total_clientes > 0
      THEN a.faturamento_total / a.total_clientes
    ELSE 0
  END AS ticket_medio_cliente,
  a.total_skus,
  a.quantidade_total,
  a.quantidade_litros,
  u.unidade_predominante
FROM cidade_agg a
LEFT JOIN unidade_por_cidade u
  ON u.cidade = a.cidade AND u.estado = a.estado;

COMMENT ON VIEW alwayson_insights_v_cidades IS
  'Território Insights: agrega por cidade/UF, unidade predominante (maior volume) e litros quando unidade L/LT.';

GRANT SELECT ON alwayson_insights_v_cidades TO anon, authenticated;
