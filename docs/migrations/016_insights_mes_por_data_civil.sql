-- Agrupa ano-mês diretamente do tipo date (civil), sem ::timestamp.
-- O KPI total_nfs já vinha de COUNT(DISTINCT nf.id); a série mensal deve somar aos mesmos NFs.
-- Projeto canônico: osukbalwykbqvoumddxz
--
-- Pré-requisito: 015_insights_clientes_dim.sql (views com JOIN clientes).

DROP VIEW IF EXISTS alwayson_insights_v_cliente_mes CASCADE;
DROP VIEW IF EXISTS alwayson_insights_v_cliente_mix CASCADE;

CREATE VIEW alwayson_insights_v_cliente_mes AS
SELECT
  nf.cnpj_cliente,
  to_char(nf.data_emissao, 'YYYY-MM') AS ano_mes,
  COALESCE(SUM(itens.valor_total), 0) AS faturamento,
  COUNT(DISTINCT nf.id)               AS total_nfs,
  COUNT(DISTINCT itens.sku)           AS total_skus,
  COALESCE(SUM(itens.quantidade), 0)  AS quantidade_total
FROM alwayson_insights_nf nf
JOIN alwayson_insights_clientes ic ON ic.cnpj_14 = nf.cnpj_cliente
LEFT JOIN alwayson_insights_nf_itens itens ON itens.nf_id = nf.id
GROUP BY nf.cnpj_cliente,
  to_char(nf.data_emissao, 'YYYY-MM');

COMMENT ON VIEW alwayson_insights_v_cliente_mes IS
  'Histórico mensal por CNPJ (mês civil de data_emissao).';

CREATE VIEW alwayson_insights_v_cliente_mix AS
SELECT
  nf.cnpj_cliente,
  itens.sku,
  MAX(COALESCE(p.descricao, NULLIF(TRIM(itens.descricao), '')))
      AS descricao,
  COUNT(DISTINCT to_char(nf.data_emissao, 'YYYY-MM')) AS meses_ativos,
  SUM(itens.quantidade)            AS quantidade_total,
  MAX(itens.unidade)               AS unidade,
  SUM(itens.valor_total)           AS faturamento_total,
  MIN(nf.data_emissao)             AS primeira_compra,
  MAX(nf.data_emissao)             AS ultima_compra
FROM alwayson_insights_nf_itens itens
JOIN alwayson_insights_nf nf ON nf.id = itens.nf_id
JOIN alwayson_insights_clientes ic ON ic.cnpj_14 = nf.cnpj_cliente
LEFT JOIN alwayson_produtos p ON p.sku = itens.sku
GROUP BY nf.cnpj_cliente, itens.sku;

COMMENT ON VIEW alwayson_insights_v_cliente_mix IS
  'Mix agregado por cliente e SKU; meses_ativos por mês civil de data_emissao.';

GRANT SELECT ON alwayson_insights_v_cliente_mes TO anon, authenticated;
GRANT SELECT ON alwayson_insights_v_cliente_mix TO anon, authenticated;
