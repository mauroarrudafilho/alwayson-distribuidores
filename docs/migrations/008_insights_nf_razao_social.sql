-- Razão social explícita no cabeçalho de NF de insights (alinhado ao template de vendas).
-- Aplicar após docs/migrations/007_insights.sql quando o projeto Supabase for vinculado.

ALTER TABLE alwayson_insights_nf
  ADD COLUMN IF NOT EXISTS razao_social text;

COMMENT ON COLUMN alwayson_insights_nf.razao_social IS
  'Razão social do cliente quando informada na planilha; nome_cliente passa a representar nome fantasia quando ambos vierem separados.';
