-- Campos adicionais do export GA vendas → insights territorial.
-- cod_emp / nome_emp: origem emitente no ERP (highlights futuros por empresa).
-- codprod_fornecedor / perfil: por linha-item; perfil já vem categorizado pela base de origem.
-- Aplicar após 008_insights_nf_razao_social.sql.

ALTER TABLE alwayson_insights_nf
  ADD COLUMN IF NOT EXISTS cod_emp text,
  ADD COLUMN IF NOT EXISTS nome_emp text;

COMMENT ON COLUMN alwayson_insights_nf.cod_emp IS
  'Código da empresa/filial no ERP na extração GA; repetido nas linhas da mesma NF — gravar valor do cabeçalho da NF (ex. primeira linha do grupo), validar consistência no parser.';
COMMENT ON COLUMN alwayson_insights_nf.nome_emp IS
  'Nome da empresa/filial emitente; uso comercial (destaques por origem), não para chave analítica territorial.';

ALTER TABLE alwayson_insights_nf_itens
  ADD COLUMN IF NOT EXISTS codprod_fornecedor text,
  ADD COLUMN IF NOT EXISTS perfil text;

COMMENT ON COLUMN alwayson_insights_nf_itens.codprod_fornecedor IS
  'Código produto fornecedor na base de origem; manter bruto. Cruzamento com SKU indústria via view/join ou de-para separado, sem sobrescrever histórico.';
COMMENT ON COLUMN alwayson_insights_nf_itens.perfil IS
  'Classificação canais/cliente na origem (ex. VAREJO & ATACAREJO); texto normatizado pelo sistema de origem.';
