-- De-para global para Insights / sell-out territorial: código vindo da base de ingestão
-- (tipicamente coluna codprod_fornecedor no export GA) → SKU oficial (alwayson_produtos.sku).
-- Não há distribuidor_id: um único mapa AlwaysOn para comparativos territorial vs fábrica.

CREATE TABLE IF NOT EXISTS alwayson_insights_produto_de_para (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_origem     text NOT NULL,
  sku_fornecedor    text NOT NULL REFERENCES alwayson_produtos(sku) ON UPDATE CASCADE ON DELETE RESTRICT,
  ativo             boolean NOT NULL DEFAULT true,
  criado_em         timestamptz NOT NULL DEFAULT now(),
  atualizado_em     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (codigo_origem)
);

CREATE INDEX IF NOT EXISTS idx_insights_de_para_sku
  ON alwayson_insights_produto_de_para (sku_fornecedor);

COMMENT ON TABLE alwayson_insights_produto_de_para IS
  'Mapeamento AlwaysOn Insights: código da planilha/base territorial (codprod_fornecedor ou equivalente) para SKU indústria em alwayson_produtos.';
COMMENT ON COLUMN alwayson_insights_produto_de_para.codigo_origem IS
  'Valor normalizado como vem ou como chave estável na ingestão (ex. 11.7002, 717). Deve coincidir com alwayson_insights_nf_itens.codprod_fornecedor quando esse campo vier preenchido.';
COMMENT ON COLUMN alwayson_insights_produto_de_para.sku_fornecedor IS
  'SKU único oficial; FK a alwayson_produtos.sku.';
