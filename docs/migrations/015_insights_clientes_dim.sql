-- Dimensão mestre de cliente por CNPJ (Insights / sell-out Arruda).
-- Geo e nomes consolidados em alwayson_insights_clientes; NF referencia só cnpj_cliente (FK).
--
-- Pré-requisitos: 007_insights, 008, 010, 011, 012, 013, 014 já aplicados no projeto osukbalwykbqvoumddxz.
--
-- Template de venda (distribuidores): já está normalizado — alwayson_faturamento.cliente_id →
-- alwayson_clientes_distribuidor (cnpj + cidade/geo em 006). Não duplicar esse modelo aqui;
-- enriquecimento BrasilAPI por CNPJ deve atualizar sempre a linha do cliente, não o faturamento.
--
-- Projeto canônico: osukbalwykbqvoumddxz

-- ─── 1. Tabela mestre ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS alwayson_insights_clientes (
  cnpj_14              text PRIMARY KEY
    CHECK (cnpj_14 ~ '^\d{14}$'),
  razao_social         text,
  nome_cliente         text,
  cidade               text,
  estado               text,
  lat                  numeric(9, 6),
  lng                  numeric(9, 6),
  geo_enriquecido_em   timestamptz,
  brasil_api_ultima_tentativa_em timestamptz,
  brasil_api_ultimo_motivo       text,
  criado_em            timestamptz NOT NULL DEFAULT now(),
  atualizado_em        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE alwayson_insights_clientes IS
  'Cadastro único por CNPJ (14 dígitos) para Insights. Geo/nomes consolidados; NFs apenas referenciam cnpj_14.';
COMMENT ON COLUMN alwayson_insights_clientes.brasil_api_ultimo_motivo IS
  'Último erro ou código quando consulta BrasilAPI falhou (ex.: http_404_v1).';

CREATE INDEX IF NOT EXISTS idx_insights_clientes_cidade
  ON alwayson_insights_clientes (cidade, estado);

CREATE OR REPLACE FUNCTION alwayson_touch_insights_clientes()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.atualizado_em := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_insights_clientes_touch ON alwayson_insights_clientes;
CREATE TRIGGER tr_insights_clientes_touch
  BEFORE UPDATE ON alwayson_insights_clientes
  FOR EACH ROW
  EXECUTE PROCEDURE alwayson_touch_insights_clientes();

-- ─── 2. Backfill a partir das NFs (antes do FK / drop columns) ───────────────

INSERT INTO alwayson_insights_clientes (
  cnpj_14,
  razao_social,
  nome_cliente,
  cidade,
  estado,
  lat,
  lng,
  geo_enriquecido_em
)
SELECT
  nf.cnpj_cliente,
  MAX(NULLIF(TRIM(nf.razao_social), '')),
  MAX(NULLIF(TRIM(nf.nome_cliente), '')),
  MAX(NULLIF(TRIM(nf.cidade), '')),
  MAX(NULLIF(TRIM(nf.estado), '')),
  MAX(nf.lat),
  MAX(nf.lng),
  MAX(nf.geo_enriquecido_em)
FROM alwayson_insights_nf nf
GROUP BY nf.cnpj_cliente
ON CONFLICT (cnpj_14) DO NOTHING;

-- ─── 3. FK na NF (views antigas ainda leem cidade em nf — não dropar colunas antes) ─

ALTER TABLE alwayson_insights_nf
  ADD CONSTRAINT alwayson_insights_nf_cnpj_cliente_fkey
  FOREIGN KEY (cnpj_cliente)
  REFERENCES alwayson_insights_clientes (cnpj_14);

-- ─── 4. Remover views que dependem de nf.cidade/nf.estado ─────────────────────

DROP VIEW IF EXISTS alwayson_insights_v_produtos CASCADE;
DROP VIEW IF EXISTS alwayson_insights_v_cliente_mix CASCADE;
DROP VIEW IF EXISTS alwayson_insights_v_cliente_mes CASCADE;
DROP VIEW IF EXISTS alwayson_insights_v_clientes CASCADE;
DROP VIEW IF EXISTS alwayson_insights_v_cidades CASCADE;

-- ─── 5. Dropar geo duplicado da NF ─────────────────────────────────────────────

DROP INDEX IF EXISTS idx_insights_nf_cidade;

ALTER TABLE alwayson_insights_nf
  DROP COLUMN IF EXISTS cidade,
  DROP COLUMN IF EXISTS estado,
  DROP COLUMN IF EXISTS lat,
  DROP COLUMN IF EXISTS lng,
  DROP COLUMN IF EXISTS geo_enriquecido_em;

COMMENT ON COLUMN alwayson_insights_nf.cnpj_cliente IS
  'CNPJ 14 dígitos; FK a alwayson_insights_clientes. Cidade/geo leem-se da dimensão.';

-- ─── 6. Views analíticas (JOIN dimensão) ──────────────────────────────────────

CREATE VIEW alwayson_insights_v_cidades AS
SELECT
  COALESCE(ic.cidade, '— sem cidade —')        AS cidade,
  COALESCE(ic.estado, '—')                    AS estado,
  COALESCE(SUM(itens.valor_total), 0)         AS faturamento_total,
  COUNT(DISTINCT nf.id)                       AS total_nfs,
  COUNT(DISTINCT nf.cnpj_cliente)             AS total_clientes,
  CASE
    WHEN COUNT(DISTINCT nf.cnpj_cliente) > 0
      THEN COALESCE(SUM(itens.valor_total), 0) / COUNT(DISTINCT nf.cnpj_cliente)
    ELSE 0
  END                                         AS ticket_medio_cliente,
  COUNT(DISTINCT itens.sku)                   AS total_skus,
  COALESCE(SUM(itens.quantidade), 0)          AS quantidade_total
FROM alwayson_insights_nf nf
JOIN alwayson_insights_clientes ic ON ic.cnpj_14 = nf.cnpj_cliente
LEFT JOIN alwayson_insights_nf_itens itens ON itens.nf_id = nf.id
GROUP BY ic.cidade, ic.estado;

CREATE VIEW alwayson_insights_v_clientes AS
SELECT
  nf.cnpj_cliente,
  MAX(NULLIF(TRIM(nf.nome_cliente), '')) AS nome_cliente,
  MAX(NULLIF(TRIM(nf.razao_social), '')) AS razao_social,
  MAX(ic.cidade)                         AS cidade,
  MAX(ic.estado)                         AS estado,
  COALESCE(SUM(itens.valor_total), 0) AS faturamento_total,
  COUNT(DISTINCT nf.id)           AS total_nfs,
  MAX(nf.data_emissao)            AS ultima_compra,
  COUNT(DISTINCT itens.sku)       AS total_skus
FROM alwayson_insights_nf nf
JOIN alwayson_insights_clientes ic ON ic.cnpj_14 = nf.cnpj_cliente
LEFT JOIN alwayson_insights_nf_itens itens ON itens.nf_id = nf.id
GROUP BY nf.cnpj_cliente;

CREATE VIEW alwayson_insights_v_cliente_mes AS
SELECT
  nf.cnpj_cliente,
  TO_CHAR(nf.data_emissao::timestamp, 'YYYY-MM') AS ano_mes,
  COALESCE(SUM(itens.valor_total), 0) AS faturamento,
  COUNT(DISTINCT nf.id)               AS total_nfs,
  COUNT(DISTINCT itens.sku)           AS total_skus,
  COALESCE(SUM(itens.quantidade), 0)  AS quantidade_total
FROM alwayson_insights_nf nf
JOIN alwayson_insights_clientes ic ON ic.cnpj_14 = nf.cnpj_cliente
LEFT JOIN alwayson_insights_nf_itens itens ON itens.nf_id = nf.id
GROUP BY nf.cnpj_cliente,
  TO_CHAR(nf.data_emissao::timestamp, 'YYYY-MM');

CREATE VIEW alwayson_insights_v_produtos AS
SELECT
  itens.sku,
  MAX(COALESCE(p.descricao, NULLIF(TRIM(itens.descricao), '')))
      AS descricao,
  MAX(COALESCE(p.categoria, '—')) AS categoria,
  SUM(itens.valor_total)          AS faturamento_total,
  SUM(itens.quantidade)           AS quantidade_total,
  MAX(itens.unidade)              AS unidade,
  COUNT(DISTINCT nf.id)           AS total_nfs,
  COUNT(DISTINCT nf.cnpj_cliente) AS total_clientes,
  COUNT(DISTINCT (COALESCE(ic.cidade, '') || '|' || COALESCE(ic.estado, '')))
                                  AS total_cidades,
  MIN(nf.data_emissao)            AS primeira_venda,
  MAX(nf.data_emissao)            AS ultima_venda
FROM alwayson_insights_nf_itens itens
JOIN alwayson_insights_nf nf ON nf.id = itens.nf_id
JOIN alwayson_insights_clientes ic ON ic.cnpj_14 = nf.cnpj_cliente
LEFT JOIN alwayson_produtos p ON p.sku = itens.sku
GROUP BY itens.sku;

CREATE VIEW alwayson_insights_v_cliente_mix AS
SELECT
  nf.cnpj_cliente,
  itens.sku,
  MAX(COALESCE(p.descricao, NULLIF(TRIM(itens.descricao), '')))
      AS descricao,
  COUNT(DISTINCT TO_CHAR(nf.data_emissao::timestamp, 'YYYY-MM')) AS meses_ativos,
  SUM(itens.quantidade)            AS quantidade_total,
  MAX(itens.unidade)               AS unidade,
  SUM(itens.valor_total)           AS faturamento_total,
  MIN(nf.data_emissao)             AS primeira_compra,
  MAX(nf.data_emissao)             AS ultima_compra
FROM alwayson_insights_nf_itens itens
JOIN alwayson_insights_nf nf ON nf.id = itens.nf_id
JOIN alwayson_insights_clientes ic ON ic.cnpj_14 = nf.cnpj_cliente
LEFT JOIN alwayson_produtos p ON p.sku = itens.sku
GROUP BY nf.cnpj_cliente, itens.sku;

COMMENT ON VIEW alwayson_insights_v_clientes IS
  'Resumo por CNPJ. Nome/razão vêm da NF (MAX); cidade/UF da dimensão alwayson_insights_clientes.';

-- ─── 7. RLS + grants (leitura anon/authenticated; escrita via service role) ─

ALTER TABLE alwayson_insights_clientes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "insights_clientes_select_authenticated" ON alwayson_insights_clientes;
CREATE POLICY "insights_clientes_select_authenticated"
  ON alwayson_insights_clientes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "insights_clientes_select_anon" ON alwayson_insights_clientes;
CREATE POLICY "insights_clientes_select_anon"
  ON alwayson_insights_clientes FOR SELECT TO anon USING (true);

GRANT SELECT ON alwayson_insights_clientes TO anon, authenticated;

GRANT SELECT ON alwayson_insights_v_cidades TO anon, authenticated;
GRANT SELECT ON alwayson_insights_v_clientes TO anon, authenticated;
GRANT SELECT ON alwayson_insights_v_produtos TO anon, authenticated;
GRANT SELECT ON alwayson_insights_v_cliente_mes TO anon, authenticated;
GRANT SELECT ON alwayson_insights_v_cliente_mix TO anon, authenticated;
