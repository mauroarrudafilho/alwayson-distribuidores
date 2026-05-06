-- Unidade de medida por linha de item (UN, CX, etc.) — alinhado ao template de vendas e ao parser futuro.
ALTER TABLE alwayson_faturamento_itens
  ADD COLUMN IF NOT EXISTS unidade text;

COMMENT ON COLUMN alwayson_faturamento_itens.unidade IS 'Unidade da quantidade do item (ex.: UN, CX).';
