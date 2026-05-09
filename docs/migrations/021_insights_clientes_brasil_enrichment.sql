-- Dimensão insights: estado de enriquecimento BrasilAPI + situação Receita persistida (skip rede em reimportações).
-- Projeto canônico: osukbalwykbqvoumddxz

ALTER TABLE alwayson_insights_clientes ADD COLUMN IF NOT EXISTS cadastro_ativo boolean;
ALTER TABLE alwayson_insights_clientes ADD COLUMN IF NOT EXISTS descricao_situacao_cadastral text;
ALTER TABLE alwayson_insights_clientes ADD COLUMN IF NOT EXISTS brasil_enriquecimento_status text;

UPDATE alwayson_insights_clientes
SET brasil_enriquecimento_status = 'pending'
WHERE brasil_enriquecimento_status IS NULL;

ALTER TABLE alwayson_insights_clientes ALTER COLUMN brasil_enriquecimento_status SET DEFAULT 'pending';
ALTER TABLE alwayson_insights_clientes ALTER COLUMN brasil_enriquecimento_status SET NOT NULL;

ALTER TABLE alwayson_insights_clientes DROP CONSTRAINT IF EXISTS chk_insights_clientes_brasil_status;
ALTER TABLE alwayson_insights_clientes ADD CONSTRAINT chk_insights_clientes_brasil_status
  CHECK (
    brasil_enriquecimento_status IN ('pending', 'processing', 'ready', 'not_found', 'error')
  );

CREATE INDEX IF NOT EXISTS idx_insights_clientes_br_status ON alwayson_insights_clientes (brasil_enriquecimento_status);

COMMENT ON COLUMN alwayson_insights_clientes.brasil_enriquecimento_status IS
  'pending=worker; processing=worker; ready=JSON OK; not_found=CNPJ inválido/definitivo; error=outras falhas.';
COMMENT ON COLUMN alwayson_insights_clientes.cadastro_ativo IS
  'Último snapshot Receita (BrasilAPI): true=ATIVA; false=outra situação; null=desconhecido ou falhou.';

-- Histórico: tentativa bem-sucedida = motivo nulo em colunas já existentes
UPDATE alwayson_insights_clientes
SET brasil_enriquecimento_status = 'ready'
WHERE brasil_api_ultima_tentativa_em IS NOT NULL AND brasil_api_ultimo_motivo IS NULL;

-- Tentativas falhas anteriores
UPDATE alwayson_insights_clientes
SET brasil_enriquecimento_status = 'error'
WHERE brasil_enriquecimento_status = 'pending' AND brasil_api_ultimo_motivo IS NOT NULL;

UPDATE alwayson_insights_clientes
SET brasil_enriquecimento_status = 'not_found'
WHERE brasil_enriquecimento_status = 'error'
  AND (
    brasil_api_ultimo_motivo ILIKE '%invalido%' OR brasil_api_ultimo_motivo ILIKE '%404%'
  );

DROP VIEW IF EXISTS alwayson_insights_v_clientes;

CREATE VIEW alwayson_insights_v_clientes AS
SELECT
  nf.cnpj_cliente,
  MAX(NULLIF(TRIM(nf.nome_cliente), '')) AS nome_cliente,
  MAX(NULLIF(TRIM(nf.razao_social), '')) AS razao_social,
  MAX(ic.cidade) AS cidade,
  MAX(ic.estado) AS estado,
  COALESCE(SUM(itens.valor_total), 0) AS faturamento_total,
  COUNT(DISTINCT nf.id) AS total_nfs,
  MAX(nf.data_emissao) AS ultima_compra,
  COUNT(DISTINCT itens.sku) AS total_skus,
  MAX(ic.brasil_enriquecimento_status) AS brasil_enriquecimento_status
FROM alwayson_insights_nf nf
JOIN alwayson_insights_clientes ic ON ic.cnpj_14 = nf.cnpj_cliente
LEFT JOIN alwayson_insights_nf_itens itens ON itens.nf_id = nf.id
GROUP BY nf.cnpj_cliente;

COMMENT ON VIEW alwayson_insights_v_clientes IS
  'Resumo por CNPJ; razão/nome vindos NF; cidade/UF e brasil_enriquecimento_status da dimensão.';

GRANT SELECT ON alwayson_insights_v_clientes TO anon, authenticated;
