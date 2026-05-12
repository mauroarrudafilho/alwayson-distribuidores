-- nome_rede (raiz): prioriza razão social nas NFs; fantasia só se razão vazia.
-- Projeto canônico: osukbalwykbqvoumddxz

DROP VIEW IF EXISTS alwayson_insights_v_rede_resumo;

CREATE VIEW alwayson_insights_v_rede_resumo AS
WITH nf_grupo AS (
  SELECT
    nf.id           AS nf_id,
    nf.cnpj_cliente,
    nf.data_emissao,
    CASE
      WHEN m.rede_id IS NOT NULL THEN 'manual'::text
      ELSE 'raiz'::text
    END AS grupo_kind,
    COALESCE(m.rede_id::text, 'auto:' || SUBSTRING(nf.cnpj_cliente, 1, 8)) AS grupo_id,
    CASE
      WHEN m.rede_id IS NOT NULL THEN r.nome
      ELSE
        SUBSTRING(nf.cnpj_cliente, 1, 2) || '.'
        || SUBSTRING(nf.cnpj_cliente, 3, 3) || '.'
        || SUBSTRING(nf.cnpj_cliente, 6, 3)
    END AS grupo_label_raw,
    NULLIF(
      TRIM(
        COALESCE(
          NULLIF(TRIM(nf.razao_social), ''),
          NULLIF(TRIM(nf.nome_cliente), '')
        )
      ),
      ''
    ) AS nome_estab_nf
  FROM alwayson_insights_nf nf
  LEFT JOIN alwayson_insights_rede_membros m ON m.cnpj_14 = nf.cnpj_cliente
  LEFT JOIN alwayson_insights_redes r ON r.id = m.rede_id
)
SELECT
  g.grupo_kind,
  g.grupo_id,
  MAX(g.grupo_label_raw) AS grupo_label,
  CASE
    WHEN MAX(g.grupo_kind::text) = 'manual' THEN MAX(g.grupo_label_raw)
    ELSE MAX(g.nome_estab_nf)
  END AS nome_rede,
  COUNT(DISTINCT g.cnpj_cliente) AS total_lojas,
  COALESCE(SUM(itens.valor_total), 0) AS faturamento_total,
  COUNT(DISTINCT g.nf_id) AS total_nfs,
  MAX(g.data_emissao) AS ultima_compra,
  COUNT(DISTINCT itens.sku) AS total_skus,
  CASE
    WHEN COUNT(DISTINCT g.cnpj_cliente) > 0
      THEN COALESCE(SUM(itens.valor_total), 0) / COUNT(DISTINCT g.cnpj_cliente)
    ELSE 0
  END AS ticket_medio_loja
FROM nf_grupo g
LEFT JOIN alwayson_insights_nf_itens itens ON itens.nf_id = g.nf_id
GROUP BY g.grupo_kind, g.grupo_id;

COMMENT ON VIEW alwayson_insights_v_rede_resumo IS
  'Sell-out por rede; nome_rede (raiz) prioriza razão social nas NFs, depois fantasia; manual = nome admin.';

GRANT SELECT ON alwayson_insights_v_rede_resumo TO authenticated;
