-- Módulo Insights — visão territorial de sell-out.
-- Upload único pelo time Arruda (admin); leitura por todos os autenticados.
-- Mesmo template de vendas dos distribuidores → comparativo maçã com maçã.
-- Chave analítica: cnpj_cliente (cliente) e cidade/estado (território).

-- ─── 1. UPLOADS ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS alwayson_insights_uploads (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome            text        NOT NULL,                             -- ex: "Base histórica Nordeste 2024-2026"
  periodo_inicio  date        NOT NULL,
  periodo_fim     date        NOT NULL,
  arquivo_nome    text        NOT NULL,
  status          text        NOT NULL DEFAULT 'processando'
                              CHECK (status IN ('processando','concluido','erro')),
  total_nfs       integer,
  total_itens     integer,
  erros           jsonb,
  criado_por      uuid        REFERENCES auth.users(id),
  criado_em       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE alwayson_insights_uploads IS
  'Controle de uploads de insights (sell-out territorial). Carga única pelo time Arruda.';

-- ─── 2. CABEÇALHO DE NF ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS alwayson_insights_nf (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id        uuid        NOT NULL REFERENCES alwayson_insights_uploads(id) ON DELETE CASCADE,

  -- Identificação da nota
  numero_nf        text        NOT NULL,
  data_emissao     date        NOT NULL,

  -- Cliente (desnormalizado; CNPJ é a âncora de cruzamento)
  cnpj_cliente     text        NOT NULL,
  nome_cliente     text,
  cidade           text,        -- enriquecido via BrasilAPI/CNPJ se não vier no arquivo
  estado           text,
  lat              numeric(9,6),
  lng              numeric(9,6),
  geo_enriquecido_em timestamptz,

  -- Hierarquia de vendas (desnormalizada para analytics sem JOIN pesado)
  codigo_vendedor   text,
  nome_vendedor     text,
  codigo_supervisor text,
  nome_supervisor   text,
  codigo_gerente    text,
  nome_gerente      text,

  -- Valor calculado como SUM(itens.valor_total)
  valor_total      numeric     NOT NULL,

  criado_em        timestamptz NOT NULL DEFAULT now(),

  -- Dentro do mesmo lote, NF + cliente devem ser únicos
  UNIQUE (upload_id, cnpj_cliente, numero_nf)
);

COMMENT ON TABLE alwayson_insights_nf IS
  'NFs do sell-out territorial. Cidade/geo enriquecidos via BrasilAPI+Nominatim.';
COMMENT ON COLUMN alwayson_insights_nf.cidade IS
  'Preenchido a partir do endereço fiscal (BrasilAPI /cnpj/v2/:cnpj). NULL = pendente.';
COMMENT ON COLUMN alwayson_insights_nf.valor_total IS
  'Calculado como SUM(alwayson_insights_nf_itens.valor_total) para a mesma NF.';

-- ─── 3. ITENS DE NF ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS alwayson_insights_nf_itens (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nf_id           uuid        NOT NULL REFERENCES alwayson_insights_nf(id) ON DELETE CASCADE,
  sku             text        NOT NULL,
  descricao       text,
  quantidade      numeric     NOT NULL,
  unidade         text,                   -- UN, CX, KG …
  valor_unitario  numeric,
  valor_total     numeric     NOT NULL
);

COMMENT ON TABLE alwayson_insights_nf_itens IS
  'Itens do sell-out insights. Granularidade SKU por NF.';

-- ─── 4. ÍNDICES ──────────────────────────────────────────────────────────────

-- Consulta por CNPJ (histórico do cliente)
CREATE INDEX IF NOT EXISTS idx_insights_nf_cnpj
  ON alwayson_insights_nf (cnpj_cliente);

-- Consulta por cidade/estado (visão territorial)
CREATE INDEX IF NOT EXISTS idx_insights_nf_cidade
  ON alwayson_insights_nf (cidade, estado);

-- Filtro por período
CREATE INDEX IF NOT EXISTS idx_insights_nf_data
  ON alwayson_insights_nf (data_emissao DESC);

-- Itens por NF (suporte a JOIN)
CREATE INDEX IF NOT EXISTS idx_insights_itens_nf
  ON alwayson_insights_nf_itens (nf_id);

-- Itens por SKU (ranking de produtos)
CREATE INDEX IF NOT EXISTS idx_insights_itens_sku
  ON alwayson_insights_nf_itens (sku);

-- Enriquecimento geo pendente
CREATE INDEX IF NOT EXISTS idx_insights_nf_geo_pendente
  ON alwayson_insights_nf (cnpj_cliente)
  WHERE geo_enriquecido_em IS NULL;

-- ─── 5. RLS ──────────────────────────────────────────────────────────────────

ALTER TABLE alwayson_insights_uploads  ENABLE ROW LEVEL SECURITY;
ALTER TABLE alwayson_insights_nf       ENABLE ROW LEVEL SECURITY;
ALTER TABLE alwayson_insights_nf_itens ENABLE ROW LEVEL SECURITY;

-- Leitura: qualquer usuário autenticado
CREATE POLICY "insights_uploads_select"  ON alwayson_insights_uploads  FOR SELECT TO authenticated USING (true);
CREATE POLICY "insights_nf_select"       ON alwayson_insights_nf       FOR SELECT TO authenticated USING (true);
CREATE POLICY "insights_itens_select"    ON alwayson_insights_nf_itens FOR SELECT TO authenticated USING (true);

-- Escrita: apenas service_role (Railway parser) — o front não escreve diretamente
-- O parser usa a service_role key e bypassa RLS. Não criar policies de INSERT/UPDATE
-- no client para evitar exposição acidental.
