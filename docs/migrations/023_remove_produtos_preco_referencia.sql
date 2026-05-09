-- Remove preço de referência: não usado no produto por ora.
-- Projeto canônico: osukbalwykbqvoumddxz

ALTER TABLE alwayson_produtos
  DROP COLUMN IF EXISTS preco_referencia;
