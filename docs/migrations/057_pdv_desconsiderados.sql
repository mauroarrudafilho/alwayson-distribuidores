-- PDVs marcados como fora do mix / não aplicáveis ao negócio.
-- Saem das listas Explorar (cobertura, prioridade, mapa) até restaurar.
--
-- Projeto canônico: osukbalwykbqvoumddxz

CREATE TABLE IF NOT EXISTS alwayson_pdv_desconsiderados (
  cnpj       char(14) PRIMARY KEY REFERENCES alwayson_pdv_universo(cnpj) ON DELETE CASCADE,
  motivo     text,
  criado_em  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pdv_desconsiderados_criado
  ON alwayson_pdv_desconsiderados (criado_em DESC);

COMMENT ON TABLE alwayson_pdv_desconsiderados IS
  'CNPJs do universo PDV explicitamente fora do mix — excluídos do Explorar e do cruzamento de cobertura.';
COMMENT ON COLUMN alwayson_pdv_desconsiderados.motivo IS
  'Texto livre ou código curto (ex.: fora_do_mix, franquia).';

ALTER TABLE alwayson_pdv_desconsiderados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS alwayson_pdv_desconsiderados_select_authenticated
  ON alwayson_pdv_desconsiderados;
CREATE POLICY alwayson_pdv_desconsiderados_select_authenticated
  ON alwayson_pdv_desconsiderados FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS alwayson_pdv_desconsiderados_write_authenticated
  ON alwayson_pdv_desconsiderados;
CREATE POLICY alwayson_pdv_desconsiderados_write_authenticated
  ON alwayson_pdv_desconsiderados FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON alwayson_pdv_desconsiderados TO authenticated;
