-- De-para: código que o distribuidor usa em relatórios/metas → SKU oficial do fornecedor (alwayson_produtos.sku).
-- O parser de ingestão / metas resolve codigo_cliente → sku_fornecedor antes de gravar itens.

CREATE TABLE IF NOT EXISTS alwayson_distribuidor_produto_de_para (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  distribuidor_id   uuid NOT NULL REFERENCES alwayson_distribuidores(id) ON DELETE CASCADE,
  codigo_cliente    text NOT NULL,
  sku_fornecedor    text NOT NULL,
  ativo             boolean NOT NULL DEFAULT true,
  criado_em         timestamptz NOT NULL DEFAULT now(),
  atualizado_em     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (distribuidor_id, codigo_cliente)
);

CREATE INDEX IF NOT EXISTS idx_de_para_dist_sku
  ON alwayson_distribuidor_produto_de_para (distribuidor_id, sku_fornecedor);

COMMENT ON TABLE alwayson_distribuidor_produto_de_para IS
  'Mapeamento por distribuidor: código interno do cliente (ERP/planilha) para SKU oficial Campestre / alwayson_produtos.sku.';
COMMENT ON COLUMN alwayson_distribuidor_produto_de_para.codigo_cliente IS
  'Código do produto como o distribuidor envia em vendas, estoque ou metas.';
COMMENT ON COLUMN alwayson_distribuidor_produto_de_para.sku_fornecedor IS
  'SKU alinhado à base oficial (ex. cadastrogeral_vinicolacampestre, coluna Código) e alwayson_produtos.sku.';
