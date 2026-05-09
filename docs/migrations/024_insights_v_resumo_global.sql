-- Uma linha com totais canónicos Insights (som directo sobre tabelas).
-- Comparar estes números com a planilha de origem; divergências indicam filtros na importação, não cliente "pendente" na API.
--
-- Projeto canônico: osukbalwykbqvoumddxz

CREATE OR REPLACE VIEW public.alwayson_insights_v_resumo_global AS
SELECT
  (SELECT COUNT(*)::bigint FROM alwayson_insights_nf) AS total_nfs,
  (SELECT COUNT(*)::bigint FROM alwayson_insights_nf_itens) AS total_linhas_itens,
  (SELECT COUNT(DISTINCT cnpj_cliente)::bigint FROM alwayson_insights_nf) AS total_cnps_com_nf,
  (SELECT COUNT(*)::bigint FROM alwayson_insights_clientes) AS total_cnps_dimensao,
  (
    SELECT COALESCE(SUM(i.valor_total), 0)::numeric
    FROM alwayson_insights_nf_itens i
  ) AS faturamento_soma_linhas_itens;

COMMENT ON VIEW public.alwayson_insights_v_resumo_global IS
  'Conferência: totais reais gravados nos Insights (independente da situação BrasilAPI na dimensão cliente).';

GRANT SELECT ON public.alwayson_insights_v_resumo_global TO authenticated;
GRANT SELECT ON public.alwayson_insights_v_resumo_global TO service_role;
