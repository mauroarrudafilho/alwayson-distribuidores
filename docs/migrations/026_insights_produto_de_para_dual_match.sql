-- De-para Insights: se codprod_fornecedor está preenchido mas não há linha no mapa,
-- passa a tentar também TRIM(sku) — evita ficar só no código territorial quando o GA
-- traz codprod interno diferente do código usado no de-para.
-- Inclui marca e detalhamento_categoria de alwayson_produtos na view de ranking.
--
-- Projeto canônico: osukbalwykbqvoumddxz

DROP VIEW IF EXISTS alwayson_insights_v_produtos CASCADE;
DROP VIEW IF EXISTS alwayson_insights_v_cliente_mix CASCADE;

CREATE VIEW alwayson_insights_v_produtos AS
SELECT
  COALESCE(d1.sku_fornecedor, d2.sku_fornecedor, TRIM(itens.sku)) AS sku,
  MAX(COALESCE(p.descricao, NULLIF(TRIM(itens.descricao), '')))
      AS descricao,
  MAX(COALESCE(p.categoria, '—')) AS categoria,
  MAX(COALESCE(p.marca, '—')) AS marca,
  MAX(COALESCE(p.detalhamento_categoria, '—')) AS detalhamento_categoria,
  SUM(itens.valor_total)          AS faturamento_total,
  SUM(itens.quantidade)           AS quantidade_total,
  MAX(itens.unidade)              AS unidade,
  COUNT(DISTINCT nf.id)           AS total_nfs,
  COUNT(DISTINCT nf.cnpj_cliente) AS total_clientes,
  COUNT(DISTINCT (COALESCE(ic.cidade, '') || '|' || COALESCE(ic.estado, '')))
                                  AS total_cidades,
  MIN(nf.data_emissao)            AS primeira_venda,
  MAX(nf.data_emissao)            AS ultima_venda
FROM alwayson_insights_nf_itens itens
JOIN alwayson_insights_nf nf ON nf.id = itens.nf_id
JOIN alwayson_insights_clientes ic ON ic.cnpj_14 = nf.cnpj_cliente
LEFT JOIN alwayson_insights_produto_de_para d1
  ON NULLIF(TRIM(itens.codprod_fornecedor), '') IS NOT NULL
  AND d1.codigo_origem = NULLIF(TRIM(itens.codprod_fornecedor), '')
LEFT JOIN alwayson_insights_produto_de_para d2
  ON d1.sku_fornecedor IS NULL
  AND d2.codigo_origem = TRIM(itens.sku)
LEFT JOIN alwayson_produtos p ON p.sku = COALESCE(d1.sku_fornecedor, d2.sku_fornecedor, TRIM(itens.sku))
GROUP BY COALESCE(d1.sku_fornecedor, d2.sku_fornecedor, TRIM(itens.sku));

COMMENT ON VIEW alwayson_insights_v_produtos IS
  'Ranking Insights: SKU fábrica via de-para (codprod primeiro, fallback sku da linha) + marca/categoria cadastro.';

CREATE VIEW alwayson_insights_v_cliente_mix AS
SELECT
  nf.cnpj_cliente,
  COALESCE(d1.sku_fornecedor, d2.sku_fornecedor, TRIM(itens.sku)) AS sku,
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
LEFT JOIN alwayson_insights_produto_de_para d1
  ON NULLIF(TRIM(itens.codprod_fornecedor), '') IS NOT NULL
  AND d1.codigo_origem = NULLIF(TRIM(itens.codprod_fornecedor), '')
LEFT JOIN alwayson_insights_produto_de_para d2
  ON d1.sku_fornecedor IS NULL
  AND d2.codigo_origem = TRIM(itens.sku)
LEFT JOIN alwayson_produtos p ON p.sku = COALESCE(d1.sku_fornecedor, d2.sku_fornecedor, TRIM(itens.sku))
GROUP BY nf.cnpj_cliente, COALESCE(d1.sku_fornecedor, d2.sku_fornecedor, TRIM(itens.sku));

COMMENT ON VIEW alwayson_insights_v_cliente_mix IS
  'Mix por cliente com mesmo fallback de-para que alwayson_insights_v_produtos.';

GRANT SELECT ON alwayson_insights_v_produtos TO anon, authenticated;
GRANT SELECT ON alwayson_insights_v_cliente_mix TO anon, authenticated;
