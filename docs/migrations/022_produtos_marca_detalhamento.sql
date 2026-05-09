-- Campos opcionais alinhados ao cadastro oficial (cadastrogeral_vinicolacampestre.xlsx — aba Produtos).
-- Projeto canônico: osukbalwykbqvoumddxz

ALTER TABLE alwayson_produtos
  ADD COLUMN IF NOT EXISTS marca text,
  ADD COLUMN IF NOT EXISTS detalhamento_categoria text;

COMMENT ON COLUMN alwayson_produtos.marca IS
  'Marca comercial do item (cadastro Vinícola Campestre).';

COMMENT ON COLUMN alwayson_produtos.detalhamento_categoria IS
  'Detalhe da categoria cadastral (ex.: TINTO SUAVE); distinto da categoria principal.';
