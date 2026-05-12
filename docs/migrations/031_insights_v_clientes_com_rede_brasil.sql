-- Inclui brasil_enriquecimento_status em v_clientes_com_rede (para bootstrap Insights alinhado a v_clientes).
-- Projeto canônico: osukbalwykbqvoumddxz

DROP VIEW IF EXISTS alwayson_insights_v_clientes_com_rede;

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
  'Clientes Insights com grupo efetivo (rede manual ou raiz CNPJ) e status BrasilAPI da dimensão.';

GRANT SELECT ON alwayson_insights_v_clientes_com_rede TO authenticated;
