-- Migration 056 — backfill UF/cidade do cadastro a partir de Insights + view de exibição.
-- Contexto: ingestão de vendas grava "—" quando não resolve geo na hora; Insights já tem
-- cidade/UF para parte da carteira. A UI fazia fallback por página; aqui persistimos e
-- expomos join estável para listagem/KPIs.

-- ─── 1. Backfill cadastro ← dimensão Insights ───────────────────────────────
UPDATE alwayson_clientes_distribuidor c
SET
  cidade = trim(ic.cidade),
  estado = upper(trim(ic.estado)),
  geo_enriquecido_em = COALESCE(c.geo_enriquecido_em, now())
FROM alwayson_insights_clientes ic
WHERE ic.cnpj_14 = regexp_replace(c.cnpj, '\D', '', 'g')
  AND (
    c.cidade IS NULL OR trim(c.cidade) IN ('', '—', '-')
    OR c.estado IS NULL OR trim(c.estado) IN ('', '—', '-')
  )
  AND nullif(trim(ic.cidade), '') IS NOT NULL
  AND trim(ic.cidade) NOT IN ('—', '-')
  AND nullif(trim(ic.estado), '') IS NOT NULL
  AND trim(ic.estado) NOT IN ('—', '-');

-- ─── 2. View: cadastro + fallback Insights (sem sobrescrever escrita) ───────
CREATE OR REPLACE VIEW alwayson_v_clientes_distribuidor_geo AS
SELECT
  c.*,
  COALESCE(
    NULLIF(NULLIF(NULLIF(trim(c.cidade), ''), '—'), '-'),
    NULLIF(NULLIF(NULLIF(trim(ic.cidade), ''), '—'), '-')
  ) AS cidade_exibicao,
  COALESCE(
    NULLIF(NULLIF(NULLIF(trim(c.estado), ''), '—'), '-'),
    NULLIF(NULLIF(NULLIF(trim(ic.estado), ''), '—'), '-')
  ) AS estado_exibicao,
  (
    (c.cidade IS NULL OR trim(c.cidade) IN ('', '—', '-')
     OR c.estado IS NULL OR trim(c.estado) IN ('', '—', '-'))
    AND ic.cnpj_14 IS NOT NULL
    AND nullif(trim(ic.cidade), '') IS NOT NULL
    AND trim(ic.cidade) NOT IN ('—', '-')
    AND nullif(trim(ic.estado), '') IS NOT NULL
    AND trim(ic.estado) NOT IN ('—', '-')
  ) AS geo_via_insights
FROM alwayson_clientes_distribuidor c
LEFT JOIN alwayson_insights_clientes ic
  ON ic.cnpj_14 = regexp_replace(c.cnpj, '\D', '', 'g');

COMMENT ON VIEW alwayson_v_clientes_distribuidor_geo IS
  'Carteira do distribuidor com cidade/UF resolvidos (cadastro ou Insights).';

GRANT SELECT ON alwayson_v_clientes_distribuidor_geo TO authenticated;
