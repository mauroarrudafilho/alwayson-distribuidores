-- Código externo do ERP do distribuidor (vendedor / supervisor / gerente), para resolução no parser de ingestão.
-- Unicidade por tenant: o mesmo código em outro distribuidor não conflita.

ALTER TABLE alwayson_vendedores_distribuidor
  ADD COLUMN IF NOT EXISTS codigo_externo text;

COMMENT ON COLUMN alwayson_vendedores_distribuidor.codigo_externo IS
  'Código do colaborador no ERP do distribuidor; combina com tipo para unicidade (dist+tipo+código) quando preenchido.';

-- Vários NULL legítimos. Unicidade por tenant + função, para não colidir V001 (vendedor) com V001 (supervisor) se o ERP reutilizar numeração.
-- Cobre busca: WHERE distribuidor_id = $1 AND tipo = $2 AND codigo_externo = $3
CREATE UNIQUE INDEX IF NOT EXISTS uq_vendedores_dist_tipo_codigo_externo
  ON alwayson_vendedores_distribuidor (distribuidor_id, tipo, codigo_externo)
  WHERE codigo_externo IS NOT NULL;
