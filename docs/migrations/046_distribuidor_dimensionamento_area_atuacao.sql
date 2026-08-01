-- Migration 046 — dimensionamento e área de atuação do distribuidor.
--
-- O cadastro tinha só identificação e contato (nome, cnpj, cidade-sede,
-- responsável, telefone, status, lead_time_dias). Faltava o que permite
-- perguntar "como estamos relativo ao potencial deste parceiro".
--
-- Três números diferentes, deliberadamente separados:
--   • carteira CADASTRADA  → derivada (count em alwayson_clientes_distribuidor)
--   • carteira DECLARADA   → o que o parceiro diz atender (coluna nova)
--   • universo da praça    → vem da área de atuação (cidades + IBGE + Insights)
-- A diferença entre a 1ª e a 2ª é qualidade de carga; entre a 2ª e a 3ª é
-- oportunidade. Um número só não distingue as duas coisas.
--
-- Projeto canônico: osukbalwykbqvoumddxz

-- ─── 1. IBGE: deduplicar antes de virar chave de referência ─────────────────
-- A tabela tinha 922 linhas para 920 municípios (CEARA-MIRIM/RN e GOVERNADOR
-- DIX-SEPT ROSADO/RN repetidos). Mantém a linha de menor id de cada código.

DELETE FROM alwayson_ibge_municipio_populacao a
USING alwayson_ibge_municipio_populacao b
WHERE a.codigo_ibge = b.codigo_ibge
  AND a.id > b.id;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ibge_municipio_codigo
  ON alwayson_ibge_municipio_populacao (codigo_ibge);

-- ─── 2. Dimensionamento no cadastro ─────────────────────────────────────────

ALTER TABLE alwayson_distribuidores
  ADD COLUMN IF NOT EXISTS carteira_declarada integer,
  ADD COLUMN IF NOT EXISTS frequencia_visita  text,
  ADD COLUMN IF NOT EXISTS inicio_parceria    date;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'alwayson_distribuidores_frequencia_visita_check'
  ) THEN
    ALTER TABLE alwayson_distribuidores
      ADD CONSTRAINT alwayson_distribuidores_frequencia_visita_check
      CHECK (frequencia_visita IS NULL OR frequencia_visita IN
             ('semanal','quinzenal','mensal','outro'));
  END IF;
END $$;

COMMENT ON COLUMN alwayson_distribuidores.carteira_declarada IS
  'Nº de PDVs que o distribuidor declara atender. Confrontar com a contagem real em alwayson_clientes_distribuidor: a diferença mede qualidade de carga, não performance.';

COMMENT ON COLUMN alwayson_distribuidores.frequencia_visita IS
  'Frequência padrão de visita do roteiro. Define a régua da positivação — cobertura mensal significa coisas diferentes num roteiro semanal e num quinzenal.';

COMMENT ON COLUMN alwayson_distribuidores.inicio_parceria IS
  'Início da parceria. Permite comparar parceiros por safra (o 3º mês de cada um) em vez de comparar absoluto entre quem tem 3 anos e quem tem 3 meses.';

-- ─── 3. Área de atuação (cidades responsáveis) ──────────────────────────────

CREATE TABLE IF NOT EXISTS alwayson_distribuidor_cidades (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  distribuidor_id uuid NOT NULL REFERENCES alwayson_distribuidores(id) ON DELETE CASCADE,
  codigo_ibge     integer NOT NULL REFERENCES alwayson_ibge_municipio_populacao(codigo_ibge)
                    ON DELETE RESTRICT,
  criado_por      uuid REFERENCES auth.users(id),
  criado_em       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (distribuidor_id, codigo_ibge)
);

COMMENT ON TABLE alwayson_distribuidor_cidades IS
  'Cidades sob responsabilidade de cada distribuidor. Ancorado no código IBGE para herdar população e cruzar com o histórico territorial do Insights.';

CREATE INDEX IF NOT EXISTS idx_distribuidor_cidades_distribuidor
  ON alwayson_distribuidor_cidades (distribuidor_id);

-- ─── 4. View de potencial da área ───────────────────────────────────────────
-- Junta a área declarada com duas referências que já existem no banco:
--   • população do município (IBGE)
--   • faturamento histórico daquela cidade no Insights — potencial DEMONSTRADO,
--     não estimado. Atenção: é o arquivo da operação anterior (jan/2022–dez/2024,
--     fechado), então serve de benchmark, nunca como meta corrente.
--
-- O join Insights↔IBGE é por lower(cidade)+estado: o IBGE grava em minúsculas
-- e o Insights em maiúsculas, ambos sem acento (920/920 casaram na validação).

DROP VIEW IF EXISTS alwayson_distribuidor_v_area_atuacao;
CREATE VIEW alwayson_distribuidor_v_area_atuacao
WITH (security_invoker = true) AS
SELECT
  d.id                                            AS distribuidor_id,
  count(dc.codigo_ibge)                           AS cidades_atuacao,
  COALESCE(sum(ibge.populacao), 0)                AS populacao_coberta,
  COALESCE(sum(ins.faturamento_total), 0)         AS potencial_demonstrado,
  COALESCE(sum(ins.total_clientes), 0)            AS pdvs_no_historico,
  d.carteira_declarada,
  (SELECT count(*) FROM alwayson_clientes_distribuidor c
    WHERE c.distribuidor_id = d.id)               AS carteira_cadastrada
FROM alwayson_distribuidores d
LEFT JOIN alwayson_distribuidor_cidades dc  ON dc.distribuidor_id = d.id
LEFT JOIN alwayson_ibge_municipio_populacao ibge ON ibge.codigo_ibge = dc.codigo_ibge
LEFT JOIN alwayson_insights_v_cidades ins
       ON ins.cidade = upper(ibge.cidade_norm) AND ins.estado = ibge.estado
GROUP BY d.id, d.carteira_declarada;

COMMENT ON VIEW alwayson_distribuidor_v_area_atuacao IS
  'Dimensionamento por distribuidor: cidades sob responsabilidade, população coberta (IBGE) e potencial demonstrado (histórico Insights 2022-2024 daquelas cidades), ao lado da carteira declarada e da cadastrada.';

-- ─── 5. RLS ─────────────────────────────────────────────────────────────────
-- Leitura a autenticados; escrita administrativa (padrão 028/035/044/045).

ALTER TABLE alwayson_distribuidor_cidades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS alwayson_distribuidor_cidades_select_authenticated ON alwayson_distribuidor_cidades;
CREATE POLICY alwayson_distribuidor_cidades_select_authenticated
  ON alwayson_distribuidor_cidades FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS alwayson_distribuidor_cidades_admin_insert ON alwayson_distribuidor_cidades;
CREATE POLICY alwayson_distribuidor_cidades_admin_insert
  ON alwayson_distribuidor_cidades FOR INSERT TO authenticated
  WITH CHECK (public.current_user_is_admin());

DROP POLICY IF EXISTS alwayson_distribuidor_cidades_admin_delete ON alwayson_distribuidor_cidades;
CREATE POLICY alwayson_distribuidor_cidades_admin_delete
  ON alwayson_distribuidor_cidades FOR DELETE TO authenticated
  USING (public.current_user_is_admin());
