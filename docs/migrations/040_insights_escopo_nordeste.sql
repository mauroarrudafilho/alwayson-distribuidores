-- Escopo Insights: apenas Nordeste (exclui SP, RS, PR, MG, DF e demais).
-- Projeto canônico: osukbalwykbqvoumddxz

-- UFs: AL, BA, CE, MA, PB, PE, PI, RN, SE

DROP VIEW IF EXISTS alwayson_insights_v_clientes_com_rede;
DROP VIEW IF EXISTS alwayson_insights_v_clientes;
DROP VIEW IF EXISTS alwayson_insights_v_cidades CASCADE;
DROP VIEW IF EXISTS alwayson_insights_v_mes_global;
DROP VIEW IF EXISTS alwayson_insights_v_produtos CASCADE;
DROP VIEW IF EXISTS alwayson_insights_v_cliente_mix CASCADE;
DROP VIEW IF EXISTS alwayson_insights_v_rede_resumo;

-- ─── Cidades ─────────────────────────────────────────────────────────────────

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

COMMENT ON VIEW alwayson_insights_v_cidades IS
  'Território Insights (Nordeste): cidade/UF, unidade predominante e litros.';

-- ─── Clientes ────────────────────────────────────────────────────────────────

CREATE VIEW alwayson_insights_v_clientes AS
WITH perfil_fat AS (
  SELECT
    nf.cnpj_cliente,
    NULLIF(TRIM(itens.perfil), '') AS perfil,
    SUM(itens.valor_total) AS fat
  FROM alwayson_insights_nf nf
  JOIN alwayson_insights_nf_itens itens ON itens.nf_id = nf.id
  JOIN alwayson_insights_clientes ic ON ic.cnpj_14 = nf.cnpj_cliente
  WHERE NULLIF(TRIM(itens.perfil), '') IS NOT NULL
    AND UPPER(TRIM(ic.estado)) IN ('AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE')
  GROUP BY nf.cnpj_cliente, NULLIF(TRIM(itens.perfil), '')
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
  COALESCE(sum(itens.valor_total), 0::numeric) AS faturamento_total,
  count(DISTINCT nf.id) AS total_nfs,
  max(nf.data_emissao) AS ultima_compra,
  count(DISTINCT itens.sku) AS total_skus,
  max(ic.brasil_enriquecimento_status) AS brasil_enriquecimento_status,
  max(pd.perfil) AS perfil
FROM alwayson_insights_nf nf
JOIN alwayson_insights_clientes ic ON ic.cnpj_14 = nf.cnpj_cliente
LEFT JOIN alwayson_insights_nf_itens itens ON itens.nf_id = nf.id
LEFT JOIN perfil_dom pd ON pd.cnpj_cliente = nf.cnpj_cliente
WHERE UPPER(TRIM(ic.estado)) IN ('AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE')
GROUP BY nf.cnpj_cliente;

COMMENT ON VIEW alwayson_insights_v_clientes IS
  'Clientes Insights (Nordeste) com perfil predominante.';

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

-- ─── Mês global / Produtos / Mix ─────────────────────────────────────────────

CREATE VIEW alwayson_insights_v_mes_global AS
SELECT
  to_char(date_trunc('month', nf.data_emissao::timestamp)::date, 'YYYY-MM') AS ano_mes,
  COALESCE(sum(itens.valor_total), 0) AS faturamento_total,
  count(DISTINCT nf.id) AS total_nfs,
  count(DISTINCT nf.cnpj_cliente) AS total_clientes,
  count(DISTINCT itens.sku) AS total_skus
FROM alwayson_insights_nf nf
JOIN alwayson_insights_clientes ic ON ic.cnpj_14 = nf.cnpj_cliente
LEFT JOIN alwayson_insights_nf_itens itens ON itens.nf_id = nf.id
WHERE UPPER(TRIM(ic.estado)) IN ('AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE')
GROUP BY 1;

CREATE VIEW alwayson_insights_v_produtos AS
SELECT
  COALESCE(d1.sku_fornecedor, d2.sku_fornecedor, TRIM(BOTH FROM itens.sku)) AS sku,
  max(COALESCE(p.descricao, NULLIF(TRIM(BOTH FROM itens.descricao), ''))) AS descricao,
  max(COALESCE(p.categoria, '—')) AS categoria,
  max(COALESCE(p.marca, '—')) AS marca,
  max(COALESCE(p.detalhamento_categoria, '—')) AS detalhamento_categoria,
  sum(itens.valor_total) AS faturamento_total,
  sum(itens.quantidade) AS quantidade_total,
  max(itens.unidade) AS unidade,
  count(DISTINCT nf.id) AS total_nfs,
  count(DISTINCT nf.cnpj_cliente) AS total_clientes,
  count(DISTINCT (COALESCE(ic.cidade, '') || '|') || COALESCE(ic.estado, '')) AS total_cidades,
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
LEFT JOIN alwayson_produtos p
  ON p.sku = COALESCE(d1.sku_fornecedor, d2.sku_fornecedor, TRIM(BOTH FROM itens.sku))
WHERE UPPER(TRIM(ic.estado)) IN ('AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE')
GROUP BY COALESCE(d1.sku_fornecedor, d2.sku_fornecedor, TRIM(BOTH FROM itens.sku));

CREATE VIEW alwayson_insights_v_cliente_mix AS
SELECT
  nf.cnpj_cliente,
  COALESCE(d1.sku_fornecedor, d2.sku_fornecedor, TRIM(BOTH FROM itens.sku)) AS sku,
  max(COALESCE(p.descricao, NULLIF(TRIM(BOTH FROM itens.descricao), ''))) AS descricao,
  count(DISTINCT to_char(nf.data_emissao::timestamp with time zone, 'YYYY-MM')) AS meses_ativos,
  sum(itens.quantidade) AS quantidade_total,
  max(itens.unidade) AS unidade,
  sum(itens.valor_total) AS faturamento_total,
  min(nf.data_emissao) AS primeira_compra,
  max(nf.data_emissao) AS ultima_compra
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
GROUP BY
  nf.cnpj_cliente,
  COALESCE(d1.sku_fornecedor, d2.sku_fornecedor, TRIM(BOTH FROM itens.sku));

-- ─── Rede resumo ─────────────────────────────────────────────────────────────

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
  COALESCE(sum(itens.valor_total), 0) AS faturamento_total,
  count(DISTINCT g.nf_id) AS total_nfs,
  max(g.data_emissao) AS ultima_compra,
  count(DISTINCT itens.sku) AS total_skus,
  CASE
    WHEN count(DISTINCT g.cnpj_cliente) > 0
      THEN COALESCE(sum(itens.valor_total), 0) / count(DISTINCT g.cnpj_cliente)::numeric
    ELSE 0
  END AS ticket_medio_loja
FROM nf_grupo g
LEFT JOIN alwayson_insights_nf_itens itens ON itens.nf_id = g.nf_id
GROUP BY g.grupo_kind, g.grupo_id
HAVING g.grupo_kind = 'manual' OR count(DISTINCT g.cnpj_cliente) > 1;

COMMENT ON VIEW alwayson_insights_v_rede_resumo IS
  'Resumo de redes Insights (Nordeste); omite raízes com uma única loja.';

-- ─── Resumo global / série mensal por cliente ────────────────────────────────

CREATE OR REPLACE VIEW alwayson_insights_v_resumo_global AS
SELECT
  (
    SELECT COUNT(*)::bigint
    FROM alwayson_insights_nf nf
    JOIN alwayson_insights_clientes ic ON ic.cnpj_14 = nf.cnpj_cliente
    WHERE UPPER(TRIM(ic.estado)) IN ('AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE')
  ) AS total_nfs,
  (
    SELECT COUNT(*)::bigint
    FROM alwayson_insights_nf_itens i
    JOIN alwayson_insights_nf nf ON nf.id = i.nf_id
    JOIN alwayson_insights_clientes ic ON ic.cnpj_14 = nf.cnpj_cliente
    WHERE UPPER(TRIM(ic.estado)) IN ('AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE')
  ) AS total_linhas_itens,
  (
    SELECT COUNT(DISTINCT nf.cnpj_cliente)::bigint
    FROM alwayson_insights_nf nf
    JOIN alwayson_insights_clientes ic ON ic.cnpj_14 = nf.cnpj_cliente
    WHERE UPPER(TRIM(ic.estado)) IN ('AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE')
  ) AS total_cnps_com_nf,
  (
    SELECT COUNT(*)::bigint
    FROM alwayson_insights_clientes ic
    WHERE UPPER(TRIM(ic.estado)) IN ('AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE')
  ) AS total_cnps_dimensao,
  (
    SELECT COALESCE(SUM(i.valor_total), 0)::numeric
    FROM alwayson_insights_nf_itens i
    JOIN alwayson_insights_nf nf ON nf.id = i.nf_id
    JOIN alwayson_insights_clientes ic ON ic.cnpj_14 = nf.cnpj_cliente
    WHERE UPPER(TRIM(ic.estado)) IN ('AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE')
  ) AS faturamento_soma_linhas_itens;

COMMENT ON VIEW alwayson_insights_v_resumo_global IS
  'Totais Insights no escopo Nordeste (AL, BA, CE, MA, PB, PE, PI, RN, SE).';

DROP VIEW IF EXISTS alwayson_insights_v_cliente_mes CASCADE;

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
WHERE UPPER(TRIM(ic.estado)) IN ('AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE')
GROUP BY nf.cnpj_cliente,
  to_char(nf.data_emissao, 'YYYY-MM');

COMMENT ON VIEW alwayson_insights_v_cliente_mes IS
  'Histórico mensal por CNPJ (Nordeste; mês civil de data_emissao).';

GRANT SELECT ON alwayson_insights_v_cidades TO anon, authenticated;
GRANT SELECT ON alwayson_insights_v_clientes TO anon, authenticated;
GRANT SELECT ON alwayson_insights_v_clientes_com_rede TO authenticated;
GRANT SELECT ON alwayson_insights_v_mes_global TO anon, authenticated;
GRANT SELECT ON alwayson_insights_v_produtos TO anon, authenticated;
GRANT SELECT ON alwayson_insights_v_cliente_mix TO anon, authenticated;
GRANT SELECT ON alwayson_insights_v_rede_resumo TO authenticated;
GRANT SELECT ON alwayson_insights_v_resumo_global TO authenticated, service_role;
GRANT SELECT ON alwayson_insights_v_cliente_mes TO anon, authenticated;
