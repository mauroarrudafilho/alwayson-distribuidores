-- Enriquecimento geográfico de alwayson_clientes_distribuidor.
-- Endereço completo derivado do CNPJ via BrasilAPI + geocodificação via Nominatim/OSM.
-- cidade e estado já existem na tabela; estas colunas complementam com detalhes e coordenadas.

ALTER TABLE alwayson_clientes_distribuidor
  ADD COLUMN IF NOT EXISTS endereco_logradouro   text,
  ADD COLUMN IF NOT EXISTS endereco_numero       text,
  ADD COLUMN IF NOT EXISTS endereco_bairro       text,
  ADD COLUMN IF NOT EXISTS endereco_cep          text,
  ADD COLUMN IF NOT EXISTS lat                   numeric(9,6),
  ADD COLUMN IF NOT EXISTS lng                   numeric(9,6),
  ADD COLUMN IF NOT EXISTS geo_enriquecido_em    timestamptz;

COMMENT ON COLUMN alwayson_clientes_distribuidor.endereco_logradouro IS
  'Logradouro (rua/av) retornado pela Receita Federal via BrasilAPI /cnpj/v1/:cnpj.';
COMMENT ON COLUMN alwayson_clientes_distribuidor.endereco_numero IS
  'Número do endereço fiscal.';
COMMENT ON COLUMN alwayson_clientes_distribuidor.endereco_bairro IS
  'Bairro do endereço fiscal.';
COMMENT ON COLUMN alwayson_clientes_distribuidor.endereco_cep IS
  'CEP sem formatação (8 dígitos).';
COMMENT ON COLUMN alwayson_clientes_distribuidor.lat IS
  'Latitude WGS-84 (geocodificada a partir do endereço fiscal via Nominatim/OSM).';
COMMENT ON COLUMN alwayson_clientes_distribuidor.lng IS
  'Longitude WGS-84.';
COMMENT ON COLUMN alwayson_clientes_distribuidor.geo_enriquecido_em IS
  'Timestamp do último enriquecimento geográfico. NULL = pendente. Permite batch de re-enriquecimento.';

-- Índice para busca/mapa por distribuidor apenas em clientes geocodificados.
CREATE INDEX IF NOT EXISTS idx_clientes_dist_geo
  ON alwayson_clientes_distribuidor (distribuidor_id)
  WHERE lat IS NOT NULL AND lng IS NOT NULL;

-- Índice para job de enriquecimento: clientes pendentes por distribuidor.
CREATE INDEX IF NOT EXISTS idx_clientes_dist_geo_pendente
  ON alwayson_clientes_distribuidor (distribuidor_id, criado_em)
  WHERE geo_enriquecido_em IS NULL;
