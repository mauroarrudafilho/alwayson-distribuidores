-- Migration 054 — Inteligência de PDV (Explorar).
--
-- Universo qualificado a partir da Receita Federal + score de potencial +
-- agregados de cobertura cruzados com a carteira do distribuidor.
-- Pipeline pesado roda no Railway (service_role); a UI só lê.
--
-- Escopo de acesso:
--   • Universo e score → filtrados pelas cidades de atuação dos distribuidores
--     visíveis ao utilizador (alwayson_distribuidor_cidades).
--   • Cobertura e prioridade → dois eixos (distribuidor + fornecedor), como
--     faturamento e metas — preserva o "E" do KAM.
--
-- Projeto canônico: osukbalwykbqvoumddxz

-- ─── 1. Enums ───────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE alwayson_pdv_nivel_geocodificacao AS ENUM (
    'numero_exato', 'logradouro', 'cep', 'setor_censitario'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE alwayson_pdv_fonte_geo AS ENUM ('cnefe', 'mapbox', 'nulo');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE alwayson_pdv_faixa AS ENUM ('A', 'B', 'C', 'D');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE alwayson_pdv_segmento AS ENUM (
    'subexplorado', 'maduro', 'revisar_cadastro', 'reduzir'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── 2. Universo (Receita + geocode) ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS alwayson_pdv_universo (
  cnpj                 char(14) PRIMARY KEY,
  cnpj_raiz            char(8) NOT NULL,
  razao_social         text,
  nome_fantasia        text,
  cnae_principal       text,
  cnae_secundarios     text[] NOT NULL DEFAULT '{}',
  situacao_cadastral   text,
  data_abertura        date,
  porte                text,
  opcao_simples        boolean,
  opcao_mei            boolean,
  capital_social       numeric,
  logradouro           text,
  numero               text,
  complemento          text,
  bairro               text,
  municipio            text,
  uf                   char(2),
  cep                  char(8),
  codigo_ibge          integer REFERENCES alwayson_ibge_municipio_populacao(codigo_ibge)
                         ON DELETE SET NULL,
  latitude             double precision,
  longitude            double precision,
  nivel_geocodificacao alwayson_pdv_nivel_geocodificacao,
  fonte_geo            alwayson_pdv_fonte_geo NOT NULL DEFAULT 'nulo',
  google_place_id      text,
  atualizado_em        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT alwayson_pdv_universo_google_place_id_key UNIQUE (google_place_id)
);

COMMENT ON TABLE alwayson_pdv_universo IS
  'PDVs qualificados (Receita Federal, CNAEs de interesse). Populado pelo pipeline Railway. Leitura restrita às cidades de atuação dos distribuidores visíveis.';

CREATE INDEX IF NOT EXISTS idx_pdv_universo_cnpj_raiz ON alwayson_pdv_universo (cnpj_raiz);
CREATE INDEX IF NOT EXISTS idx_pdv_universo_codigo_ibge ON alwayson_pdv_universo (codigo_ibge);
CREATE INDEX IF NOT EXISTS idx_pdv_universo_uf_municipio ON alwayson_pdv_universo (uf, municipio);
CREATE INDEX IF NOT EXISTS idx_pdv_universo_cnae ON alwayson_pdv_universo (cnae_principal);

-- ─── 3. Score (modelo) ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS alwayson_pdv_score (
  cnpj                      char(14) NOT NULL REFERENCES alwayson_pdv_universo(cnpj) ON DELETE CASCADE,
  versao_modelo             text NOT NULL,
  score_potencial           numeric,
  faixa                     alwayson_pdv_faixa,
  potencial_estimado_mensal numeric,
  features                  jsonb NOT NULL DEFAULT '{}',
  calculado_em              timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (cnpj, versao_modelo)
);

COMMENT ON TABLE alwayson_pdv_score IS
  'Potencial estimado por CNPJ e versão do modelo. Herda escopo geográfico via join com alwayson_pdv_universo.';

CREATE INDEX IF NOT EXISTS idx_pdv_score_versao ON alwayson_pdv_score (versao_modelo);
CREATE INDEX IF NOT EXISTS idx_pdv_score_faixa ON alwayson_pdv_score (faixa);

-- ─── 4. Cobertura (agregado por parceiro × fornecedor) ───────────────────────

CREATE TABLE IF NOT EXISTS alwayson_pdv_cobertura (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  distribuidor_id         uuid NOT NULL REFERENCES alwayson_distribuidores(id) ON DELETE CASCADE,
  fornecedor_tenant_id    uuid NOT NULL REFERENCES alwayson_tenants(id) ON DELETE CASCADE,
  uf                      char(2) NOT NULL,
  municipio               text NOT NULL,
  bairro                  text NOT NULL DEFAULT '',
  cnae_grupo              text NOT NULL,
  codigo_ibge             integer REFERENCES alwayson_ibge_municipio_populacao(codigo_ibge)
                            ON DELETE SET NULL,
  qtd_qualificados        integer NOT NULL DEFAULT 0,
  qtd_atendidos           integer NOT NULL DEFAULT 0,
  percentual_cobertura    numeric,
  potencial_nao_atendido  numeric,
  calculado_em            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (distribuidor_id, fornecedor_tenant_id, uf, municipio, bairro, cnae_grupo)
);

COMMENT ON TABLE alwayson_pdv_cobertura IS
  'Cobertura de PDVs qualificados vs atendidos, por microrregião e grupo de CNAE, no recorte distribuidor × fornecedor.';

CREATE INDEX IF NOT EXISTS idx_pdv_cobertura_distribuidor
  ON alwayson_pdv_cobertura (distribuidor_id);
CREATE INDEX IF NOT EXISTS idx_pdv_cobertura_fornecedor
  ON alwayson_pdv_cobertura (fornecedor_tenant_id);
CREATE INDEX IF NOT EXISTS idx_pdv_cobertura_ibge
  ON alwayson_pdv_cobertura (codigo_ibge);

-- ─── 5. Prioridade (cruzamento carteira × potencial) ─────────────────────────

CREATE TABLE IF NOT EXISTS alwayson_pdv_prioridade (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  distribuidor_id            uuid NOT NULL REFERENCES alwayson_distribuidores(id) ON DELETE CASCADE,
  fornecedor_tenant_id       uuid NOT NULL REFERENCES alwayson_tenants(id) ON DELETE CASCADE,
  cnpj                       char(14) NOT NULL REFERENCES alwayson_pdv_universo(cnpj) ON DELETE CASCADE,
  cliente_id                 uuid REFERENCES alwayson_clientes_distribuidor(id) ON DELETE SET NULL,
  versao_modelo              text NOT NULL,
  segmento                   alwayson_pdv_segmento NOT NULL,
  potencial_estimado_mensal  numeric,
  compra_media_mensal        numeric,
  gap_reais                  numeric,
  percentual_do_potencial    numeric,
  vendedor_id                uuid REFERENCES alwayson_vendedores_distribuidor(id) ON DELETE SET NULL,
  calculado_em               timestamptz NOT NULL DEFAULT now(),
  UNIQUE (distribuidor_id, fornecedor_tenant_id, cnpj, versao_modelo)
);

COMMENT ON TABLE alwayson_pdv_prioridade IS
  'Ranking de priorização: subexplorados e demais segmentos da carteira cruzada com o score. Escopo distribuidor × fornecedor.';

CREATE INDEX IF NOT EXISTS idx_pdv_prioridade_distribuidor
  ON alwayson_pdv_prioridade (distribuidor_id);
CREATE INDEX IF NOT EXISTS idx_pdv_prioridade_segmento_gap
  ON alwayson_pdv_prioridade (distribuidor_id, fornecedor_tenant_id, segmento, gap_reais DESC NULLS LAST);

-- ─── 6. Função auxiliar — códigos IBGE visíveis ─────────────────────────────

CREATE OR REPLACE FUNCTION public.current_user_pdv_codigos_ibge_visiveis()
RETURNS TABLE (codigo_ibge integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT DISTINCT dc.codigo_ibge
  FROM alwayson_distribuidor_cidades dc
  WHERE public.current_user_is_admin()
     OR dc.distribuidor_id IN (
       SELECT d.distribuidor_id FROM public.current_user_distribuidores_visiveis() d
     );
$$;

COMMENT ON FUNCTION public.current_user_pdv_codigos_ibge_visiveis() IS
  'Municípios IBGE alcançáveis via cidades de atuação dos distribuidores visíveis ao utilizador. Base do escopo geográfico do Explorar.';

REVOKE EXECUTE ON FUNCTION public.current_user_pdv_codigos_ibge_visiveis() FROM anon;
GRANT EXECUTE ON FUNCTION public.current_user_pdv_codigos_ibge_visiveis() TO authenticated;

-- ─── 7. RLS ──────────────────────────────────────────────────────────────────
-- Escrita só service_role (pipeline Railway). SELECT conforme escopo.

ALTER TABLE alwayson_pdv_universo ENABLE ROW LEVEL SECURITY;
ALTER TABLE alwayson_pdv_score ENABLE ROW LEVEL SECURITY;
ALTER TABLE alwayson_pdv_cobertura ENABLE ROW LEVEL SECURITY;
ALTER TABLE alwayson_pdv_prioridade ENABLE ROW LEVEL SECURITY;

-- 7.1 Universo — cidades de atuação dos distribuidores visíveis
DROP POLICY IF EXISTS alwayson_pdv_universo_select_escopo ON alwayson_pdv_universo;
CREATE POLICY alwayson_pdv_universo_select_escopo
  ON alwayson_pdv_universo FOR SELECT TO authenticated
  USING (
    public.current_user_is_admin()
    OR codigo_ibge IN (
      SELECT v.codigo_ibge FROM public.current_user_pdv_codigos_ibge_visiveis() v
    )
  );

-- 7.2 Score — herda escopo geográfico do universo
DROP POLICY IF EXISTS alwayson_pdv_score_select_escopo ON alwayson_pdv_score;
CREATE POLICY alwayson_pdv_score_select_escopo
  ON alwayson_pdv_score FOR SELECT TO authenticated
  USING (
    public.current_user_is_admin()
    OR EXISTS (
      SELECT 1 FROM alwayson_pdv_universo u
      WHERE u.cnpj = alwayson_pdv_score.cnpj
    )
  );

-- 7.3 Cobertura — dois eixos (KAM)
DROP POLICY IF EXISTS alwayson_pdv_cobertura_select_escopo ON alwayson_pdv_cobertura;
CREATE POLICY alwayson_pdv_cobertura_select_escopo
  ON alwayson_pdv_cobertura FOR SELECT TO authenticated
  USING (
    public.current_user_is_admin()
    OR (
      distribuidor_id IN (SELECT d.distribuidor_id FROM public.current_user_distribuidores_visiveis() d)
      AND fornecedor_tenant_id IN (SELECT f.tenant_id FROM public.current_user_fornecedores_visiveis() f)
    )
  );

-- 7.4 Prioridade — dois eixos (KAM)
DROP POLICY IF EXISTS alwayson_pdv_prioridade_select_escopo ON alwayson_pdv_prioridade;
CREATE POLICY alwayson_pdv_prioridade_select_escopo
  ON alwayson_pdv_prioridade FOR SELECT TO authenticated
  USING (
    public.current_user_is_admin()
    OR (
      distribuidor_id IN (SELECT d.distribuidor_id FROM public.current_user_distribuidores_visiveis() d)
      AND fornecedor_tenant_id IN (SELECT f.tenant_id FROM public.current_user_fornecedores_visiveis() f)
    )
  );

GRANT SELECT ON alwayson_pdv_universo TO authenticated;
GRANT SELECT ON alwayson_pdv_score TO authenticated;
GRANT SELECT ON alwayson_pdv_cobertura TO authenticated;
GRANT SELECT ON alwayson_pdv_prioridade TO authenticated;
