-- Série mensal global do sell-out Insights (todas NFs da base).
-- Alinha com sempreon_insights_v_cliente_mes: mesmo join dimensão + soma nos itens.
-- Projeto canônico: osukbalwykbqvoumddxz

CREATE OR REPLACE VIEW public.alwayson_insights_v_mes_global AS
SELECT
  TO_CHAR(date_trunc('month', nf.data_emissao)::date, 'YYYY-MM') AS ano_mes,
  COALESCE(SUM(itens.valor_total), 0)::numeric                         AS faturamento_total,
  COUNT(DISTINCT nf.id)::bigint                                        AS total_nfs,
  COUNT(DISTINCT nf.cnpj_cliente)::bigint                               AS total_clientes,
  COUNT(DISTINCT itens.sku)::bigint                                    AS total_skus
FROM public.alwayson_insights_nf nf
JOIN public.alwayson_insights_clientes ic ON ic.cnpj_14 = nf.cnpj_cliente
LEFT JOIN public.alwayson_insights_nf_itens itens ON itens.nf_id = nf.id
GROUP BY TO_CHAR(date_trunc('month', nf.data_emissao)::date, 'YYYY-MM');

COMMENT ON VIEW public.alwayson_insights_v_mes_global IS
  'Sell-out Insights agregado por mês civil (data_emissao); faturamento = soma das linhas de item.';

GRANT SELECT ON public.alwayson_insights_v_mes_global TO anon, authenticated;
