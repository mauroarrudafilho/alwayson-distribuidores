-- Views agregadas Insights (sell-out territorial).
-- Dependências: docs/migrations/007_insights.sql, 008, 010; alwayson_produtos (002).
-- Depois: aplicar docs/migrations/013_insights_anon_reads.sql (SPA usa anon key).

-- ─── alwayson_insights_v_cidades ───────────────────────────────────────────

CREATE OR REPLACE VIEW alwayson_insights_v_cidades AS
SELECT
  COALESCE(nf.cidade, '— sem cidade —')        AS cidade,
  COALESCE(nf.estado, '—')                     AS estado,
  COALESCE(SUM(itens.valor_total), 0)          AS faturamento_total,
  COUNT(DISTINCT nf.id)                       AS total_nfs,
  COUNT(DISTINCT nf.cnpj_cliente)             AS total_clientes,
  CASE
    WHEN COUNT(DISTINCT nf.cnpj_cliente) > 0
      THEN COALESCE(SUM(itens.valor_total), 0) / COUNT(DISTINCT nf.cnpj_cliente)
    ELSE 0
  END                                         AS ticket_medio_cliente,
  COUNT(DISTINCT itens.sku)                   AS total_skus,
  COALESCE(SUM(itens.quantidade), 0)          AS quantidade_total
FROM alwayson_insights_nf nf
LEFT JOIN alwayson_insights_nf_itens itens ON itens.nf_id = nf.id
GROUP BY nf.cidade, nf.estado;

COMMENT ON VIEW alwayson_insights_v_cidades IS
  'Visão territorial agregada por cidade/estado (aba Insights).';

-- ─── alwayson_insights_v_clientes ────────────────────────────────────────────

CREATE OR REPLACE VIEW alwayson_insights_v_clientes AS
SELECT
  nf.cnpj_cliente,
  MAX(NULLIF(TRIM(nf.nome_cliente), '')) AS nome_cliente,
  MAX(NULLIF(TRIM(nf.razao_social), '')) AS razao_social,
  MAX(nf.cidade)                  AS cidade,
  MAX(nf.estado)                  AS estado,
  COALESCE(SUM(itens.valor_total), 0) AS faturamento_total,
  COUNT(DISTINCT nf.id)           AS total_nfs,
  MAX(nf.data_emissao)            AS ultima_compra,
  COUNT(DISTINCT itens.sku)       AS total_skus
FROM alwayson_insights_nf nf
LEFT JOIN alwayson_insights_nf_itens itens ON itens.nf_id = nf.id
GROUP BY nf.cnpj_cliente;

COMMENT ON VIEW alwayson_insights_v_clientes IS
  'Resumo por CNPJ — listagens Insights e drill-down. nome_cliente = nome fantasia da NF; razao_social à parte.';

-- ─── alwayson_insights_v_produtos ────────────────────────────────────────────

CREATE OR REPLACE VIEW alwayson_insights_v_produtos AS
SELECT
  itens.sku,
  MAX(COALESCE(p.descricao, NULLIF(TRIM(itens.descricao), '')))
      AS descricao,
  MAX(COALESCE(p.categoria, '—')) AS categoria,
  SUM(itens.valor_total)          AS faturamento_total,
  SUM(itens.quantidade)           AS quantidade_total,
  MAX(itens.unidade)              AS unidade,
  COUNT(DISTINCT nf.id)           AS total_nfs,
  COUNT(DISTINCT nf.cnpj_cliente) AS total_clientes,
  COUNT(DISTINCT (nf.cidade || '|' || COALESCE(nf.estado,'')))
                                  AS total_cidades,
  MIN(nf.data_emissao)            AS primeira_venda,
  MAX(nf.data_emissao)            AS ultima_venda
FROM alwayson_insights_nf_itens itens
JOIN alwayson_insights_nf nf ON nf.id = itens.nf_id
LEFT JOIN alwayson_produtos p ON p.sku = itens.sku
GROUP BY itens.sku;

COMMENT ON VIEW alwayson_insights_v_produtos IS
  'Visão por SKU (aba Produtos). Categoria de alwayson_produtos quando existir.';

-- ─── alwayson_insights_v_cliente_mes ───────────────────────────────────────

CREATE OR REPLACE VIEW alwayson_insights_v_cliente_mes AS
SELECT
  nf.cnpj_cliente,
  TO_CHAR(nf.data_emissao::timestamp, 'YYYY-MM') AS ano_mes,
  COALESCE(SUM(itens.valor_total), 0) AS faturamento,
  COUNT(DISTINCT nf.id)               AS total_nfs,
  COUNT(DISTINCT itens.sku)           AS total_skus,
  COALESCE(SUM(itens.quantidade), 0)  AS quantidade_total
FROM alwayson_insights_nf nf
LEFT JOIN alwayson_insights_nf_itens itens ON itens.nf_id = nf.id
GROUP BY nf.cnpj_cliente,
  TO_CHAR(nf.data_emissao::timestamp, 'YYYY-MM');

COMMENT ON VIEW alwayson_insights_v_cliente_mes IS
  'Histórico mensal por CNPJ.';

-- ─── alwayson_insights_v_cliente_mix ────────────────────────────────────────

CREATE OR REPLACE VIEW alwayson_insights_v_cliente_mix AS
SELECT
  nf.cnpj_cliente,
  itens.sku,
  MAX(COALESCE(p.descricao, NULLIF(TRIM(itens.descricao), '')))
      AS descricao,
  COUNT(DISTINCT TO_CHAR(nf.data_emissao::timestamp, 'YYYY-MM')) AS meses_ativos,
  SUM(itens.quantidade)            AS quantidade_total,
  MAX(itens.unidade)               AS unidade,
  SUM(itens.valor_total)           AS faturamento_total,
  MIN(nf.data_emissao)             AS primeira_compra,
  MAX(nf.data_emissao)             AS ultima_compra
FROM alwayson_insights_nf_itens itens
JOIN alwayson_insights_nf nf ON nf.id = itens.nf_id
LEFT JOIN alwayson_produtos p ON p.sku = itens.sku
GROUP BY nf.cnpj_cliente, itens.sku;

COMMENT ON VIEW alwayson_insights_v_cliente_mix IS
  'Mix agregado por cliente e SKU.';
