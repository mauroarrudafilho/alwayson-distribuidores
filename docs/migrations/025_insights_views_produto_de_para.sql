-- Liga alwayson_insights_produto_de_para às views de produto do Insights.
-- Sem isso, itens com código territorial em sku/codprod_fornecedor não encontravam
-- alwayson_produtos (ex.: 718 → 11.7004), e categoria/descrição vinham vazias.
--
-- Projeto canônico: osukbalwykbqvoumddxz
-- Pré-requisitos: 011_insights_produto_de_para.sql, 015_insights_clientes_dim.sql

DROP VIEW IF EXISTS alwayson_insights_v_produtos CASCADE;
DROP VIEW IF EXISTS alwayson_insights_v_cliente_mix CASCADE;

CREATE VIEW alwayson_insights_v_produtos AS
SELECT
  COALESCE(dp.sku_fornecedor, TRIM(itens.sku)) AS sku,
  MAX(COALESCE(p.descricao, NULLIF(TRIM(itens.descricao), '')))
      AS descricao,
  MAX(COALESCE(p.categoria, '—')) AS categoria,
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
LEFT JOIN alwayson_insights_produto_de_para dp
  ON dp.codigo_origem = COALESCE(
    NULLIF(TRIM(itens.codprod_fornecedor), ''),
    TRIM(itens.sku)
  )
LEFT JOIN alwayson_produtos p ON p.sku = COALESCE(dp.sku_fornecedor, TRIM(itens.sku))
GROUP BY COALESCE(dp.sku_fornecedor, TRIM(itens.sku));

COMMENT ON VIEW alwayson_insights_v_produtos IS
  'Ranking de produtos Insights; SKU agregado pelo de-para global (codigo_origem → sku_fornecedor) quando existir.';

CREATE VIEW alwayson_insights_v_cliente_mix AS
SELECT
  nf.cnpj_cliente,
  COALESCE(dp.sku_fornecedor, TRIM(itens.sku)) AS sku,
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
LEFT JOIN alwayson_insights_produto_de_para dp
  ON dp.codigo_origem = COALESCE(
    NULLIF(TRIM(itens.codprod_fornecedor), ''),
    TRIM(itens.sku)
  )
LEFT JOIN alwayson_produtos p ON p.sku = COALESCE(dp.sku_fornecedor, TRIM(itens.sku))
GROUP BY nf.cnpj_cliente, COALESCE(dp.sku_fornecedor, TRIM(itens.sku));

COMMENT ON VIEW alwayson_insights_v_cliente_mix IS
  'Mix por cliente; SKU resolvido via alwayson_insights_produto_de_para quando aplicável.';

GRANT SELECT ON alwayson_insights_v_produtos TO anon, authenticated;
GRANT SELECT ON alwayson_insights_v_cliente_mix TO anon, authenticated;
