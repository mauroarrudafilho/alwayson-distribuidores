-- Corrige inflação de faturamento nas views que faziam JOIN com itens e SUM(nf.valor_total).
-- Cada linha da NF repetia o valor total da nota → KPI mensal/listagens não batiam com o mix (soma das linhas).
-- Também separa nome fantasia (nome_cliente) e razão social (razao_social) na view de clientes.
--
-- Projeto canônico: osukbalwykbqvoumddxz
--
-- Nota: PostgreSQL não permite CREATE OR REPLACE quando a lista de colunas muda; por isso DROP + CREATE.
-- Grants (aba anon) — ver docs/migrations/013_insights_anon_reads.sql

DROP VIEW IF EXISTS alwayson_insights_v_cliente_mes CASCADE;
DROP VIEW IF EXISTS alwayson_insights_v_clientes CASCADE;
DROP VIEW IF EXISTS alwayson_insights_v_cidades CASCADE;

CREATE VIEW alwayson_insights_v_cidades AS
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

CREATE VIEW alwayson_insights_v_clientes AS
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

CREATE VIEW alwayson_insights_v_cliente_mes AS
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

COMMENT ON VIEW alwayson_insights_v_clientes IS
  'Resumo por CNPJ — listagens Insights e drill-down. nome_cliente = nome fantasia da NF; razao_social à parte.';

GRANT SELECT ON alwayson_insights_v_cidades TO anon, authenticated;
GRANT SELECT ON alwayson_insights_v_clientes TO anon, authenticated;
GRANT SELECT ON alwayson_insights_v_cliente_mes TO anon, authenticated;
