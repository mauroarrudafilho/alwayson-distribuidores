-- Drill-down do SKU: agregações no banco (evita cap PostgREST de 1000 linhas brutas).
-- Mesmo escopo Nordeste + de-para de alwayson_insights_v_produtos.
-- Projeto canônico: osukbalwykbqvoumddxz

DROP VIEW IF EXISTS alwayson_insights_v_produto_clientes CASCADE;
DROP VIEW IF EXISTS alwayson_insights_v_produto_cidades CASCADE;
DROP VIEW IF EXISTS alwayson_insights_v_produto_mes CASCADE;
DROP VIEW IF EXISTS alwayson_insights_v_produto_uf CASCADE;

-- ─── Clientes por SKU ────────────────────────────────────────────────────────

CREATE VIEW alwayson_insights_v_produto_clientes AS
SELECT
  COALESCE(d1.sku_fornecedor, d2.sku_fornecedor, TRIM(BOTH FROM itens.sku)) AS sku,
  nf.cnpj_cliente,
  max(
    COALESCE(
      NULLIF(TRIM(BOTH FROM nf.nome_cliente), ''),
      NULLIF(TRIM(BOTH FROM nf.razao_social), ''),
      '—'
    )
  ) AS nome_cliente,
  max(COALESCE(NULLIF(TRIM(BOTH FROM ic.cidade), ''), '—')) AS cidade,
  max(COALESCE(NULLIF(TRIM(BOTH FROM ic.estado), ''), '—')) AS estado,
  sum(itens.quantidade) AS quantidade_total,
  sum(itens.valor_total) AS faturamento_total,
  count(DISTINCT nf.id) AS total_nfs,
  min(nf.data_emissao) AS primeira_venda,
  max(nf.data_emissao) AS ultima_venda
FROM alwayson_insights_nf_itens itens
JOIN alwayson_insights_nf nf ON nf.id = itens.nf_id
JOIN alwayson_insights_clientes ic ON ic.cnpj_14 = nf.cnpj_cliente
LEFT JOIN alwayson_insights_produto_de_para d1
  ON NULLIF(TRIM(BOTH FROM itens.codprod_fornecedor), '') IS NOT NULL
 AND d1.codigo_origem = NULLIF(TRIM(BOTH FROM itens.codprod_fornecedor), '')
LEFT JOIN alwayson_insights_produto_de_para d2
  ON d1.sku_fornecedor IS NULL
 AND d2.codigo_origem = TRIM(BOTH FROM itens.sku)
WHERE UPPER(TRIM(ic.estado)) IN ('AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE')
GROUP BY
  COALESCE(d1.sku_fornecedor, d2.sku_fornecedor, TRIM(BOTH FROM itens.sku)),
  nf.cnpj_cliente;

COMMENT ON VIEW alwayson_insights_v_produto_clientes IS
  'Faturamento do SKU (fábrica/de-para) por cliente — escopo Nordeste.';

-- ─── Cidades por SKU ─────────────────────────────────────────────────────────

CREATE VIEW alwayson_insights_v_produto_cidades AS
SELECT
  COALESCE(d1.sku_fornecedor, d2.sku_fornecedor, TRIM(BOTH FROM itens.sku)) AS sku,
  COALESCE(NULLIF(TRIM(BOTH FROM ic.cidade), ''), '—') AS cidade,
  COALESCE(NULLIF(TRIM(BOTH FROM ic.estado), ''), '—') AS estado,
  sum(itens.quantidade) AS quantidade_total,
  sum(itens.valor_total) AS faturamento_total,
  count(DISTINCT nf.cnpj_cliente) AS total_clientes,
  count(DISTINCT nf.id) AS total_nfs
FROM alwayson_insights_nf_itens itens
JOIN alwayson_insights_nf nf ON nf.id = itens.nf_id
JOIN alwayson_insights_clientes ic ON ic.cnpj_14 = nf.cnpj_cliente
LEFT JOIN alwayson_insights_produto_de_para d1
  ON NULLIF(TRIM(BOTH FROM itens.codprod_fornecedor), '') IS NOT NULL
 AND d1.codigo_origem = NULLIF(TRIM(BOTH FROM itens.codprod_fornecedor), '')
LEFT JOIN alwayson_insights_produto_de_para d2
  ON d1.sku_fornecedor IS NULL
 AND d2.codigo_origem = TRIM(BOTH FROM itens.sku)
WHERE UPPER(TRIM(ic.estado)) IN ('AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE')
GROUP BY
  COALESCE(d1.sku_fornecedor, d2.sku_fornecedor, TRIM(BOTH FROM itens.sku)),
  COALESCE(NULLIF(TRIM(BOTH FROM ic.cidade), ''), '—'),
  COALESCE(NULLIF(TRIM(BOTH FROM ic.estado), ''), '—');

COMMENT ON VIEW alwayson_insights_v_produto_cidades IS
  'Faturamento do SKU por cidade/UF — escopo Nordeste.';

-- ─── Série mensal por SKU ────────────────────────────────────────────────────

CREATE VIEW alwayson_insights_v_produto_mes AS
SELECT
  COALESCE(d1.sku_fornecedor, d2.sku_fornecedor, TRIM(BOTH FROM itens.sku)) AS sku,
  to_char(date_trunc('month', nf.data_emissao)::date, 'YYYY-MM') AS ano_mes,
  sum(itens.valor_total) AS faturamento_total,
  sum(itens.quantidade) AS quantidade_total,
  count(DISTINCT nf.cnpj_cliente) AS total_clientes,
  count(DISTINCT nf.id) AS total_nfs
FROM alwayson_insights_nf_itens itens
JOIN alwayson_insights_nf nf ON nf.id = itens.nf_id
JOIN alwayson_insights_clientes ic ON ic.cnpj_14 = nf.cnpj_cliente
LEFT JOIN alwayson_insights_produto_de_para d1
  ON NULLIF(TRIM(BOTH FROM itens.codprod_fornecedor), '') IS NOT NULL
 AND d1.codigo_origem = NULLIF(TRIM(BOTH FROM itens.codprod_fornecedor), '')
LEFT JOIN alwayson_insights_produto_de_para d2
  ON d1.sku_fornecedor IS NULL
 AND d2.codigo_origem = TRIM(BOTH FROM itens.sku)
WHERE UPPER(TRIM(ic.estado)) IN ('AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE')
GROUP BY
  COALESCE(d1.sku_fornecedor, d2.sku_fornecedor, TRIM(BOTH FROM itens.sku)),
  to_char(date_trunc('month', nf.data_emissao)::date, 'YYYY-MM');

COMMENT ON VIEW alwayson_insights_v_produto_mes IS
  'Série mensal de sell-out por SKU — escopo Nordeste.';

-- ─── UF por SKU ──────────────────────────────────────────────────────────────

CREATE VIEW alwayson_insights_v_produto_uf AS
SELECT
  COALESCE(d1.sku_fornecedor, d2.sku_fornecedor, TRIM(BOTH FROM itens.sku)) AS sku,
  COALESCE(NULLIF(TRIM(BOTH FROM ic.estado), ''), '—') AS estado,
  sum(itens.valor_total) AS faturamento_total,
  sum(itens.quantidade) AS quantidade_total,
  count(DISTINCT nf.cnpj_cliente) AS total_clientes,
  count(DISTINCT (COALESCE(ic.cidade, '') || '|') || COALESCE(ic.estado, '')) AS total_cidades,
  count(DISTINCT nf.id) AS total_nfs
FROM alwayson_insights_nf_itens itens
JOIN alwayson_insights_nf nf ON nf.id = itens.nf_id
JOIN alwayson_insights_clientes ic ON ic.cnpj_14 = nf.cnpj_cliente
LEFT JOIN alwayson_insights_produto_de_para d1
  ON NULLIF(TRIM(BOTH FROM itens.codprod_fornecedor), '') IS NOT NULL
 AND d1.codigo_origem = NULLIF(TRIM(BOTH FROM itens.codprod_fornecedor), '')
LEFT JOIN alwayson_insights_produto_de_para d2
  ON d1.sku_fornecedor IS NULL
 AND d2.codigo_origem = TRIM(BOTH FROM itens.sku)
WHERE UPPER(TRIM(ic.estado)) IN ('AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE')
GROUP BY
  COALESCE(d1.sku_fornecedor, d2.sku_fornecedor, TRIM(BOTH FROM itens.sku)),
  COALESCE(NULLIF(TRIM(BOTH FROM ic.estado), ''), '—');

COMMENT ON VIEW alwayson_insights_v_produto_uf IS
  'Faturamento do SKU por UF — escopo Nordeste.';

GRANT SELECT ON alwayson_insights_v_produto_clientes TO anon, authenticated;
GRANT SELECT ON alwayson_insights_v_produto_cidades TO anon, authenticated;
GRANT SELECT ON alwayson_insights_v_produto_mes TO anon, authenticated;
GRANT SELECT ON alwayson_insights_v_produto_uf TO anon, authenticated;
