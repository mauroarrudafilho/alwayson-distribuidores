-- Perfil predominante do cliente (canal da origem) nas views de Insights.
-- Projeto canônico: osukbalwykbqvoumddxz

DROP VIEW IF EXISTS alwayson_insights_v_clientes_com_rede;
DROP VIEW IF EXISTS alwayson_insights_v_clientes;

CREATE VIEW alwayson_insights_v_clientes AS
WITH perfil_fat AS (
  SELECT
    nf.cnpj_cliente,
    NULLIF(TRIM(itens.perfil), '') AS perfil,
    SUM(itens.valor_total) AS fat
  FROM alwayson_insights_nf nf
  JOIN alwayson_insights_nf_itens itens ON itens.nf_id = nf.id
  WHERE NULLIF(TRIM(itens.perfil), '') IS NOT NULL
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
GROUP BY nf.cnpj_cliente;

COMMENT ON VIEW alwayson_insights_v_clientes IS
  'Clientes Insights com perfil predominante (canal) por faturamento nas linhas de NF.';

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

COMMENT ON VIEW alwayson_insights_v_clientes_com_rede IS
  'Clientes Insights com grupo (rede/raiz), status BrasilAPI e perfil predominante.';

GRANT SELECT ON alwayson_insights_v_clientes TO anon, authenticated;
GRANT SELECT ON alwayson_insights_v_clientes_com_rede TO authenticated;
