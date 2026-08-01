-- Insights: só entra no mix o que resolve para alwayson_produtos (catálogo indústria).
-- Códigos sem vínculo ficam em alwayson_insights_v_produtos_nao_mapeados para de-para manual.
-- Projeto canônico: osukbalwykbqvoumddxz

-- ─── Helper: linhas de NF já resolvidas para SKU indústria ────────────────────

DROP VIEW IF EXISTS alwayson_insights_v_itens_industria CASCADE;

CREATE VIEW alwayson_insights_v_itens_industria AS
SELECT
  itens.id AS item_id,
  itens.nf_id,
  itens.quantidade,
  itens.valor_total,
  itens.unidade,
  itens.perfil,
  COALESCE(d1.sku_fornecedor, d2.sku_fornecedor, TRIM(BOTH FROM itens.sku)) AS sku,
  p.descricao AS produto_descricao,
  p.categoria,
  p.marca,
  p.detalhamento_categoria,
  NULLIF(TRIM(BOTH FROM itens.codprod_fornecedor), '') AS codprod_fornecedor,
  TRIM(BOTH FROM itens.sku) AS sku_origem_linha,
  NULLIF(TRIM(BOTH FROM itens.descricao), '') AS descricao_origem
FROM alwayson_insights_nf_itens itens
LEFT JOIN alwayson_insights_produto_de_para d1
  ON NULLIF(TRIM(BOTH FROM itens.codprod_fornecedor), '') IS NOT NULL
 AND d1.codigo_origem = NULLIF(TRIM(BOTH FROM itens.codprod_fornecedor), '')
LEFT JOIN alwayson_insights_produto_de_para d2
  ON d1.sku_fornecedor IS NULL
 AND d2.codigo_origem = TRIM(BOTH FROM itens.sku)
INNER JOIN alwayson_produtos p
  ON p.sku = COALESCE(d1.sku_fornecedor, d2.sku_fornecedor, TRIM(BOTH FROM itens.sku));

COMMENT ON VIEW alwayson_insights_v_itens_industria IS
  'Itens Insights cujo SKU resolvido (de-para ou sku da linha) existe em alwayson_produtos.';

-- ─── Produtos / mix (somente indústria) ──────────────────────────────────────

DROP VIEW IF EXISTS alwayson_insights_v_produtos CASCADE;
DROP VIEW IF EXISTS alwayson_insights_v_cliente_mix CASCADE;

CREATE VIEW alwayson_insights_v_produtos AS
SELECT
  i.sku,
  max(COALESCE(i.produto_descricao, i.descricao_origem)) AS descricao,
  max(COALESCE(i.categoria, '—')) AS categoria,
  max(COALESCE(i.marca, '—')) AS marca,
  max(COALESCE(i.detalhamento_categoria, '—')) AS detalhamento_categoria,
  sum(i.valor_total) AS faturamento_total,
  sum(i.quantidade) AS quantidade_total,
  max(i.unidade) AS unidade,
  count(DISTINCT nf.id) AS total_nfs,
  count(DISTINCT nf.cnpj_cliente) AS total_clientes,
  count(DISTINCT (COALESCE(ic.cidade, '') || '|') || COALESCE(ic.estado, '')) AS total_cidades,
  min(nf.data_emissao) AS primeira_venda,
  max(nf.data_emissao) AS ultima_venda
FROM alwayson_insights_v_itens_industria i
JOIN alwayson_insights_nf nf ON nf.id = i.nf_id
JOIN alwayson_insights_clientes ic ON ic.cnpj_14 = nf.cnpj_cliente
WHERE UPPER(TRIM(ic.estado)) IN ('AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE')
GROUP BY i.sku;

COMMENT ON VIEW alwayson_insights_v_produtos IS
  'Mix Insights (Nordeste) — apenas SKUs do cadastro alwayson_produtos.';

CREATE VIEW alwayson_insights_v_cliente_mix AS
SELECT
  nf.cnpj_cliente,
  i.sku,
  max(COALESCE(i.produto_descricao, i.descricao_origem)) AS descricao,
  count(DISTINCT to_char(nf.data_emissao::timestamp with time zone, 'YYYY-MM')) AS meses_ativos,
  sum(i.quantidade) AS quantidade_total,
  max(i.unidade) AS unidade,
  sum(i.valor_total) AS faturamento_total,
  min(nf.data_emissao) AS primeira_compra,
  max(nf.data_emissao) AS ultima_compra
FROM alwayson_insights_v_itens_industria i
JOIN alwayson_insights_nf nf ON nf.id = i.nf_id
JOIN alwayson_insights_clientes ic ON ic.cnpj_14 = nf.cnpj_cliente
WHERE UPPER(TRIM(ic.estado)) IN ('AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE')
GROUP BY nf.cnpj_cliente, i.sku;

COMMENT ON VIEW alwayson_insights_v_cliente_mix IS
  'Mix por cliente (Nordeste) — apenas SKUs do cadastro alwayson_produtos.';

-- ─── Drill SKU ───────────────────────────────────────────────────────────────

DROP VIEW IF EXISTS alwayson_insights_v_produto_clientes CASCADE;
DROP VIEW IF EXISTS alwayson_insights_v_produto_cidades CASCADE;
DROP VIEW IF EXISTS alwayson_insights_v_produto_mes CASCADE;
DROP VIEW IF EXISTS alwayson_insights_v_produto_uf CASCADE;

CREATE VIEW alwayson_insights_v_produto_clientes AS
SELECT
  i.sku,
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
  sum(i.quantidade) AS quantidade_total,
  sum(i.valor_total) AS faturamento_total,
  count(DISTINCT nf.id) AS total_nfs,
  min(nf.data_emissao) AS primeira_venda,
  max(nf.data_emissao) AS ultima_venda
FROM alwayson_insights_v_itens_industria i
JOIN alwayson_insights_nf nf ON nf.id = i.nf_id
JOIN alwayson_insights_clientes ic ON ic.cnpj_14 = nf.cnpj_cliente
WHERE UPPER(TRIM(ic.estado)) IN ('AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE')
GROUP BY i.sku, nf.cnpj_cliente;

CREATE VIEW alwayson_insights_v_produto_cidades AS
SELECT
  i.sku,
  COALESCE(NULLIF(TRIM(BOTH FROM ic.cidade), ''), '—') AS cidade,
  COALESCE(NULLIF(TRIM(BOTH FROM ic.estado), ''), '—') AS estado,
  sum(i.quantidade) AS quantidade_total,
  sum(i.valor_total) AS faturamento_total,
  count(DISTINCT nf.cnpj_cliente) AS total_clientes,
  count(DISTINCT nf.id) AS total_nfs
FROM alwayson_insights_v_itens_industria i
JOIN alwayson_insights_nf nf ON nf.id = i.nf_id
JOIN alwayson_insights_clientes ic ON ic.cnpj_14 = nf.cnpj_cliente
WHERE UPPER(TRIM(ic.estado)) IN ('AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE')
GROUP BY
  i.sku,
  COALESCE(NULLIF(TRIM(BOTH FROM ic.cidade), ''), '—'),
  COALESCE(NULLIF(TRIM(BOTH FROM ic.estado), ''), '—');

CREATE VIEW alwayson_insights_v_produto_mes AS
SELECT
  i.sku,
  to_char(date_trunc('month', nf.data_emissao)::date, 'YYYY-MM') AS ano_mes,
  sum(i.valor_total) AS faturamento_total,
  sum(i.quantidade) AS quantidade_total,
  count(DISTINCT nf.cnpj_cliente) AS total_clientes,
  count(DISTINCT nf.id) AS total_nfs
FROM alwayson_insights_v_itens_industria i
JOIN alwayson_insights_nf nf ON nf.id = i.nf_id
JOIN alwayson_insights_clientes ic ON ic.cnpj_14 = nf.cnpj_cliente
WHERE UPPER(TRIM(ic.estado)) IN ('AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE')
GROUP BY i.sku, to_char(date_trunc('month', nf.data_emissao)::date, 'YYYY-MM');

CREATE VIEW alwayson_insights_v_produto_uf AS
SELECT
  i.sku,
  COALESCE(NULLIF(TRIM(BOTH FROM ic.estado), ''), '—') AS estado,
  sum(i.valor_total) AS faturamento_total,
  sum(i.quantidade) AS quantidade_total,
  count(DISTINCT nf.cnpj_cliente) AS total_clientes,
  count(DISTINCT (COALESCE(ic.cidade, '') || '|') || COALESCE(ic.estado, '')) AS total_cidades,
  count(DISTINCT nf.id) AS total_nfs
FROM alwayson_insights_v_itens_industria i
JOIN alwayson_insights_nf nf ON nf.id = i.nf_id
JOIN alwayson_insights_clientes ic ON ic.cnpj_14 = nf.cnpj_cliente
WHERE UPPER(TRIM(ic.estado)) IN ('AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE')
GROUP BY i.sku, COALESCE(NULLIF(TRIM(BOTH FROM ic.estado), ''), '—');

-- ─── Território / clientes / mês (só fat. de SKUs indústria) ─────────────────

DROP VIEW IF EXISTS alwayson_insights_v_clientes_com_rede;
DROP VIEW IF EXISTS alwayson_insights_v_clientes;
DROP VIEW IF EXISTS alwayson_insights_v_cidades CASCADE;
DROP VIEW IF EXISTS alwayson_insights_v_mes_global;
DROP VIEW IF EXISTS alwayson_insights_v_cliente_mes CASCADE;
DROP VIEW IF EXISTS alwayson_insights_v_rede_resumo;

CREATE VIEW alwayson_insights_v_cidades AS
WITH base AS (
  SELECT
    COALESCE(ic.cidade, '— sem cidade —') AS cidade,
    COALESCE(ic.estado, '—') AS estado,
    nf.id AS nf_id,
    nf.cnpj_cliente,
    i.sku,
    i.quantidade,
    i.valor_total,
    UPPER(TRIM(COALESCE(i.unidade, ''))) AS unidade_norm
  FROM alwayson_insights_v_itens_industria i
  JOIN alwayson_insights_nf nf ON nf.id = i.nf_id
  JOIN alwayson_insights_clientes ic ON ic.cnpj_14 = nf.cnpj_cliente
  WHERE UPPER(TRIM(ic.estado)) IN ('AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE')
),
cidade_agg AS (
  SELECT
    cidade,
    estado,
    COALESCE(SUM(valor_total), 0) AS faturamento_total,
    COUNT(DISTINCT nf_id) AS total_nfs,
    COUNT(DISTINCT cnpj_cliente) AS total_clientes,
    COUNT(DISTINCT sku) AS total_skus,
    COALESCE(SUM(quantidade), 0) AS quantidade_total,
    COALESCE(SUM(quantidade) FILTER (
      WHERE unidade_norm IN ('L', 'LT', 'LITRO', 'LITROS', 'LTR')
    ), 0) AS quantidade_litros
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
    WHEN a.total_clientes > 0 THEN a.faturamento_total / a.total_clientes
    ELSE 0
  END AS ticket_medio_cliente,
  a.total_skus,
  a.quantidade_total,
  a.quantidade_litros,
  u.unidade_predominante
FROM cidade_agg a
LEFT JOIN unidade_por_cidade u ON u.cidade = a.cidade AND u.estado = a.estado;

CREATE VIEW alwayson_insights_v_clientes AS
WITH perfil_fat AS (
  SELECT
    nf.cnpj_cliente,
    NULLIF(TRIM(i.perfil), '') AS perfil,
    SUM(i.valor_total) AS fat
  FROM alwayson_insights_v_itens_industria i
  JOIN alwayson_insights_nf nf ON nf.id = i.nf_id
  JOIN alwayson_insights_clientes ic ON ic.cnpj_14 = nf.cnpj_cliente
  WHERE NULLIF(TRIM(i.perfil), '') IS NOT NULL
    AND UPPER(TRIM(ic.estado)) IN ('AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE')
  GROUP BY nf.cnpj_cliente, NULLIF(TRIM(i.perfil), '')
),
perfil_dom AS (
  SELECT DISTINCT ON (cnpj_cliente)
    cnpj_cliente,
    perfil
  FROM perfil_fat
  ORDER BY cnpj_cliente, fat DESC
)
SELECT
  nf.cnpj_cliente,
  max(NULLIF(TRIM(BOTH FROM nf.nome_cliente), ''::text)) AS nome_cliente,
  max(NULLIF(TRIM(BOTH FROM nf.razao_social), ''::text)) AS razao_social,
  max(ic.cidade) AS cidade,
  max(ic.estado) AS estado,
  COALESCE(sum(i.valor_total), 0::numeric) AS faturamento_total,
  count(DISTINCT nf.id) AS total_nfs,
  max(nf.data_emissao) AS ultima_compra,
  count(DISTINCT i.sku) AS total_skus,
  max(ic.brasil_enriquecimento_status) AS brasil_enriquecimento_status,
  max(pd.perfil) AS perfil
FROM alwayson_insights_nf nf
JOIN alwayson_insights_clientes ic ON ic.cnpj_14 = nf.cnpj_cliente
JOIN alwayson_insights_v_itens_industria i ON i.nf_id = nf.id
LEFT JOIN perfil_dom pd ON pd.cnpj_cliente = nf.cnpj_cliente
WHERE UPPER(TRIM(ic.estado)) IN ('AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE')
GROUP BY nf.cnpj_cliente;

CREATE VIEW alwayson_insights_v_clientes_com_rede AS
SELECT
  v.cnpj_cliente,
  v.nome_cliente,
  v.razao_social,
  v.cidade,
  v.estado,
  v.faturamento_total,
  v.total_nfs,
  v.ultima_compra,
  v.total_skus,
  v.brasil_enriquecimento_status,
  v.perfil,
  SUBSTRING(v.cnpj_cliente, 1, 8) AS cnpj_raiz,
  m.rede_id,
  r.nome AS rede_nome,
  CASE
    WHEN m.rede_id IS NOT NULL THEN 'manual'::text
    ELSE 'raiz'::text
  END AS grupo_kind,
  COALESCE(m.rede_id::text, 'auto:' || SUBSTRING(v.cnpj_cliente, 1, 8)) AS grupo_id,
  CASE
    WHEN m.rede_id IS NOT NULL THEN r.nome
    ELSE
      SUBSTRING(v.cnpj_cliente, 1, 2) || '.'
      || SUBSTRING(v.cnpj_cliente, 3, 3) || '.'
      || SUBSTRING(v.cnpj_cliente, 6, 3)
  END AS grupo_label
FROM alwayson_insights_v_clientes v
LEFT JOIN alwayson_insights_rede_membros m ON m.cnpj_14 = v.cnpj_cliente
LEFT JOIN alwayson_insights_redes r ON r.id = m.rede_id;

CREATE VIEW alwayson_insights_v_mes_global AS
SELECT
  to_char(date_trunc('month', nf.data_emissao::timestamp)::date, 'YYYY-MM') AS ano_mes,
  COALESCE(sum(i.valor_total), 0) AS faturamento_total,
  count(DISTINCT nf.id) AS total_nfs,
  count(DISTINCT nf.cnpj_cliente) AS total_clientes,
  count(DISTINCT i.sku) AS total_skus
FROM alwayson_insights_v_itens_industria i
JOIN alwayson_insights_nf nf ON nf.id = i.nf_id
JOIN alwayson_insights_clientes ic ON ic.cnpj_14 = nf.cnpj_cliente
WHERE UPPER(TRIM(ic.estado)) IN ('AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE')
GROUP BY 1;

CREATE VIEW alwayson_insights_v_cliente_mes AS
SELECT
  nf.cnpj_cliente,
  to_char(nf.data_emissao, 'YYYY-MM') AS ano_mes,
  COALESCE(SUM(i.valor_total), 0) AS faturamento,
  COUNT(DISTINCT nf.id) AS total_nfs,
  COUNT(DISTINCT i.sku) AS total_skus,
  COALESCE(SUM(i.quantidade), 0) AS quantidade_total
FROM alwayson_insights_v_itens_industria i
JOIN alwayson_insights_nf nf ON nf.id = i.nf_id
JOIN alwayson_insights_clientes ic ON ic.cnpj_14 = nf.cnpj_cliente
WHERE UPPER(TRIM(ic.estado)) IN ('AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE')
GROUP BY nf.cnpj_cliente, to_char(nf.data_emissao, 'YYYY-MM');

CREATE VIEW alwayson_insights_v_rede_resumo AS
WITH nf_grupo AS (
  SELECT
    nf.id AS nf_id,
    nf.cnpj_cliente,
    nf.data_emissao,
    CASE
      WHEN m.rede_id IS NOT NULL THEN 'manual'::text
      ELSE 'raiz'::text
    END AS grupo_kind,
    COALESCE(m.rede_id::text, 'auto:' || substring(nf.cnpj_cliente, 1, 8)) AS grupo_id,
    CASE
      WHEN m.rede_id IS NOT NULL THEN r.nome
      ELSE
        (substring(nf.cnpj_cliente, 1, 2) || '.' || substring(nf.cnpj_cliente, 3, 3) || '.' || substring(nf.cnpj_cliente, 6, 3))
    END AS grupo_label_raw,
    NULLIF(
      TRIM(BOTH FROM COALESCE(
        NULLIF(TRIM(BOTH FROM nf.razao_social), ''),
        NULLIF(TRIM(BOTH FROM nf.nome_cliente), '')
      )),
      ''
    ) AS nome_estab_nf
  FROM alwayson_insights_nf nf
  JOIN alwayson_insights_clientes ic ON ic.cnpj_14 = nf.cnpj_cliente
  LEFT JOIN alwayson_insights_rede_membros m ON m.cnpj_14 = nf.cnpj_cliente
  LEFT JOIN alwayson_insights_redes r ON r.id = m.rede_id
  WHERE UPPER(TRIM(ic.estado)) IN ('AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE')
)
SELECT
  g.grupo_kind,
  g.grupo_id,
  max(g.grupo_label_raw) AS grupo_label,
  CASE
    WHEN max(g.grupo_kind) = 'manual' THEN max(g.grupo_label_raw)
    ELSE max(g.nome_estab_nf)
  END AS nome_rede,
  count(DISTINCT g.cnpj_cliente) AS total_lojas,
  COALESCE(sum(i.valor_total), 0) AS faturamento_total,
  count(DISTINCT g.nf_id) AS total_nfs,
  max(g.data_emissao) AS ultima_compra,
  count(DISTINCT i.sku) AS total_skus,
  CASE
    WHEN count(DISTINCT g.cnpj_cliente) > 0
      THEN COALESCE(sum(i.valor_total), 0) / count(DISTINCT g.cnpj_cliente)::numeric
    ELSE 0
  END AS ticket_medio_loja
FROM nf_grupo g
JOIN alwayson_insights_v_itens_industria i ON i.nf_id = g.nf_id
GROUP BY g.grupo_kind, g.grupo_id
HAVING g.grupo_kind = 'manual' OR count(DISTINCT g.cnpj_cliente) > 1;

-- ─── Não mapeados (para de-para manual) ──────────────────────────────────────

DROP VIEW IF EXISTS alwayson_insights_v_produtos_nao_mapeados CASCADE;

CREATE VIEW alwayson_insights_v_produtos_nao_mapeados AS
WITH linhas AS (
  SELECT
    COALESCE(
      NULLIF(TRIM(BOTH FROM itens.codprod_fornecedor), ''),
      NULLIF(TRIM(BOTH FROM itens.sku), '')
    ) AS codigo_origem,
    TRIM(BOTH FROM itens.sku) AS sku_linha,
    NULLIF(TRIM(BOTH FROM itens.descricao), '') AS descricao_linha,
    COALESCE(d1.sku_fornecedor, d2.sku_fornecedor, TRIM(BOTH FROM itens.sku)) AS sku_resolvido,
    p.sku AS sku_industria,
    itens.valor_total,
    itens.quantidade
  FROM alwayson_insights_nf_itens itens
  JOIN alwayson_insights_nf nf ON nf.id = itens.nf_id
  JOIN alwayson_insights_clientes ic ON ic.cnpj_14 = nf.cnpj_cliente
  LEFT JOIN alwayson_insights_produto_de_para d1
    ON NULLIF(TRIM(BOTH FROM itens.codprod_fornecedor), '') IS NOT NULL
   AND d1.codigo_origem = NULLIF(TRIM(BOTH FROM itens.codprod_fornecedor), '')
  LEFT JOIN alwayson_insights_produto_de_para d2
    ON d1.sku_fornecedor IS NULL
   AND d2.codigo_origem = TRIM(BOTH FROM itens.sku)
  LEFT JOIN alwayson_produtos p
    ON p.sku = COALESCE(d1.sku_fornecedor, d2.sku_fornecedor, TRIM(BOTH FROM itens.sku))
  WHERE UPPER(TRIM(ic.estado)) IN ('AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE')
)
SELECT
  codigo_origem,
  max(sku_linha) AS sku_exemplo,
  max(descricao_linha) AS descricao,
  max(sku_resolvido) AS sku_resolvido_atual,
  sum(valor_total) AS faturamento_total,
  sum(quantidade) AS quantidade_total,
  count(*)::bigint AS total_linhas
FROM linhas
WHERE sku_industria IS NULL
  AND codigo_origem IS NOT NULL
  AND codigo_origem <> ''
GROUP BY codigo_origem;

COMMENT ON VIEW alwayson_insights_v_produtos_nao_mapeados IS
  'Códigos Insights (Nordeste) sem SKU no cadastro alwayson_produtos — candidatos a de-para.';

-- ─── Grants ──────────────────────────────────────────────────────────────────

GRANT SELECT ON alwayson_insights_v_itens_industria TO anon, authenticated;
GRANT SELECT ON alwayson_insights_v_produtos TO anon, authenticated;
GRANT SELECT ON alwayson_insights_v_cliente_mix TO anon, authenticated;
GRANT SELECT ON alwayson_insights_v_produto_clientes TO anon, authenticated;
GRANT SELECT ON alwayson_insights_v_produto_cidades TO anon, authenticated;
GRANT SELECT ON alwayson_insights_v_produto_mes TO anon, authenticated;
GRANT SELECT ON alwayson_insights_v_produto_uf TO anon, authenticated;
GRANT SELECT ON alwayson_insights_v_cidades TO anon, authenticated;
GRANT SELECT ON alwayson_insights_v_clientes TO anon, authenticated;
GRANT SELECT ON alwayson_insights_v_clientes_com_rede TO authenticated;
GRANT SELECT ON alwayson_insights_v_mes_global TO anon, authenticated;
GRANT SELECT ON alwayson_insights_v_cliente_mes TO anon, authenticated;
GRANT SELECT ON alwayson_insights_v_rede_resumo TO authenticated;
GRANT SELECT ON alwayson_insights_v_produtos_nao_mapeados TO anon, authenticated;
