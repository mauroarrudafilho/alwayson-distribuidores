-- Migration 047 — fornecedor como segundo eixo do dado.
--
-- Até aqui o dado tinha um eixo só: `distribuidor_id`. Mas o que se importa é
-- sempre o recorte de **um fornecedor dentro de um distribuidor** — o próprio
-- arquivo da primeira carga diz isso no nome ("FORNECEDOR 38496_PARATY.xls").
-- Com um fornecedor só isso não incomodava; com o segundo, "o fornecedor vê o
-- que é dele" fica impossível de responder sem o carimbo.
--
-- Esta migration prepara o terreno. **Não** mexe nas policies de leitura ainda:
-- os carimbos precisam existir e estar preenchidos antes de qualquer regra
-- passar a depender deles. As policies vêm em migration própria.
--
-- Regra de acesso pretendida (confirmada com o product owner):
--   • KAM                  → fornecedor ∈ seus  E  distribuidor ∈ seus
--   • Gestor do fornecedor → fornecedor ∈ seus, qualquer distribuidor
--   • Distribuidor         → seu distribuidor, qualquer fornecedor
-- O "E" do KAM é o ponto delicado: com "OU" ele enxergaria o fornecedor dele em
-- distribuidores de outro KAM.
--
-- Projeto canônico: osukbalwykbqvoumddxz

-- ─── 1. Relação comercial fornecedor ↔ distribuidor ─────────────────────────
-- Cadastro explícito, não derivado de "quem já faturou": um parceiro recém
-- contratado precisa existir na relação antes da primeira nota.

CREATE TABLE IF NOT EXISTS alwayson_fornecedor_distribuidores (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fornecedor_tenant_id uuid NOT NULL REFERENCES alwayson_tenants(id) ON DELETE CASCADE,
  distribuidor_id      uuid NOT NULL REFERENCES alwayson_distribuidores(id) ON DELETE CASCADE,
  ativo                boolean NOT NULL DEFAULT true,
  criado_por           uuid REFERENCES auth.users(id),
  criado_em            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fornecedor_tenant_id, distribuidor_id)
);

COMMENT ON TABLE alwayson_fornecedor_distribuidores IS
  'Quais distribuidores cada fornecedor atende. Base do escopo de acesso e do carimbo de ingestão.';

CREATE INDEX IF NOT EXISTS idx_fornecedor_distribuidores_fornecedor
  ON alwayson_fornecedor_distribuidores (fornecedor_tenant_id);
CREATE INDEX IF NOT EXISTS idx_fornecedor_distribuidores_distribuidor
  ON alwayson_fornecedor_distribuidores (distribuidor_id);

-- FK não consegue garantir que o tenant é do tipo certo (índice único parcial
-- não serve de alvo de FK), então valida por trigger.
CREATE OR REPLACE FUNCTION public.fn_alwayson_valida_tenant_fornecedor()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM alwayson_tenants t
    WHERE t.id = NEW.fornecedor_tenant_id AND t.tipo = 'fornecedor'
  ) THEN
    RAISE EXCEPTION 'tenant % não é do tipo fornecedor', NEW.fornecedor_tenant_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_valida_tenant_fornecedor ON alwayson_fornecedor_distribuidores;
CREATE TRIGGER trg_valida_tenant_fornecedor
BEFORE INSERT OR UPDATE ON alwayson_fornecedor_distribuidores
FOR EACH ROW EXECUTE FUNCTION public.fn_alwayson_valida_tenant_fornecedor();

-- ─── 2. Carimbo nas tabelas que são "de um fornecedor" ──────────────────────
-- Ficam de fora, deliberadamente:
--   • alwayson_clientes_distribuidor  → o cliente é do distribuidor
--   • alwayson_vendedores_distribuidor→ a equipe é do distribuidor
--   • alwayson_insights_*             → territorial, sem dono de fornecedor

ALTER TABLE alwayson_relatorios_ingestao
  ADD COLUMN IF NOT EXISTS fornecedor_tenant_id uuid REFERENCES alwayson_tenants(id);
ALTER TABLE alwayson_faturamento
  ADD COLUMN IF NOT EXISTS fornecedor_tenant_id uuid REFERENCES alwayson_tenants(id);
ALTER TABLE alwayson_produtos
  ADD COLUMN IF NOT EXISTS fornecedor_tenant_id uuid REFERENCES alwayson_tenants(id);
ALTER TABLE alwayson_metas_distribuidor
  ADD COLUMN IF NOT EXISTS fornecedor_tenant_id uuid REFERENCES alwayson_tenants(id);
ALTER TABLE alwayson_estoque_distribuidor
  ADD COLUMN IF NOT EXISTS fornecedor_tenant_id uuid REFERENCES alwayson_tenants(id);

CREATE INDEX IF NOT EXISTS idx_faturamento_fornecedor
  ON alwayson_faturamento (fornecedor_tenant_id);
CREATE INDEX IF NOT EXISTS idx_relatorios_fornecedor
  ON alwayson_relatorios_ingestao (fornecedor_tenant_id);
CREATE INDEX IF NOT EXISTS idx_produtos_fornecedor
  ON alwayson_produtos (fornecedor_tenant_id);

-- ─── 3. Backfill ────────────────────────────────────────────────────────────
-- Só faz sentido enquanto existe exatamente um fornecedor: todo o dado atual é
-- dele. Com dois ou mais, atribuir seria chute — a migration se recusa e o
-- preenchimento passa a ser manual.

DO $$
DECLARE
  v_fornecedor uuid;
  v_qtd        integer;
BEGIN
  -- `min(uuid)` não existe no Postgres; conta e busca em passos separados.
  SELECT count(*) INTO v_qtd FROM alwayson_tenants WHERE tipo = 'fornecedor';
  SELECT id INTO v_fornecedor FROM alwayson_tenants WHERE tipo = 'fornecedor' LIMIT 1;

  IF v_qtd = 1 THEN
    UPDATE alwayson_relatorios_ingestao   SET fornecedor_tenant_id = v_fornecedor WHERE fornecedor_tenant_id IS NULL;
    UPDATE alwayson_faturamento           SET fornecedor_tenant_id = v_fornecedor WHERE fornecedor_tenant_id IS NULL;
    UPDATE alwayson_produtos              SET fornecedor_tenant_id = v_fornecedor WHERE fornecedor_tenant_id IS NULL;
    UPDATE alwayson_metas_distribuidor    SET fornecedor_tenant_id = v_fornecedor WHERE fornecedor_tenant_id IS NULL;
    UPDATE alwayson_estoque_distribuidor  SET fornecedor_tenant_id = v_fornecedor WHERE fornecedor_tenant_id IS NULL;

    -- Relação comercial com todo distribuidor que já tem dado carregado.
    INSERT INTO alwayson_fornecedor_distribuidores (fornecedor_tenant_id, distribuidor_id)
    SELECT v_fornecedor, d.id FROM alwayson_distribuidores d
    ON CONFLICT (fornecedor_tenant_id, distribuidor_id) DO NOTHING;

    RAISE NOTICE 'Backfill aplicado ao fornecedor %', v_fornecedor;
  ELSE
    RAISE NOTICE 'Backfill ignorado: % tenants do tipo fornecedor (esperado 1)', v_qtd;
  END IF;
END $$;

-- ─── 4. Funções de escopo (preparam as policies) ────────────────────────────
-- Ainda não usadas por nenhuma policy — existem para que a migration seguinte
-- expresse a regra sem repetir subconsulta em cada tabela.

CREATE OR REPLACE FUNCTION public.current_user_fornecedor_tenants()
RETURNS TABLE (tenant_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.id
  FROM alwayson_tenants t
  JOIN alwayson_memberships m ON m.tenant_id = t.id
  WHERE m.user_id = auth.uid() AND m.ativo AND t.tipo = 'fornecedor';
$$;

COMMENT ON FUNCTION public.current_user_fornecedor_tenants() IS
  'Tenants de fornecedor a que o utilizador pertence. Metade da regra do KAM.';

CREATE OR REPLACE FUNCTION public.current_user_distribuidores()
RETURNS TABLE (distribuidor_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.distribuidor_id
  FROM alwayson_tenants t
  JOIN alwayson_memberships m ON m.tenant_id = t.id
  WHERE m.user_id = auth.uid() AND m.ativo
    AND t.tipo = 'distribuidor' AND t.distribuidor_id IS NOT NULL;
$$;

COMMENT ON FUNCTION public.current_user_distribuidores() IS
  'Distribuidores a que o utilizador tem acesso. A outra metade da regra do KAM.';

-- Não expor a utilizador não autenticado (o advisor sinaliza SECURITY DEFINER
-- executável por anon).
REVOKE EXECUTE ON FUNCTION public.current_user_fornecedor_tenants() FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_user_distribuidores() FROM anon;

-- ─── 5. RLS da tabela de relação ────────────────────────────────────────────

ALTER TABLE alwayson_fornecedor_distribuidores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS alwayson_fornecedor_distribuidores_select_authenticated ON alwayson_fornecedor_distribuidores;
CREATE POLICY alwayson_fornecedor_distribuidores_select_authenticated
  ON alwayson_fornecedor_distribuidores FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS alwayson_fornecedor_distribuidores_admin_write ON alwayson_fornecedor_distribuidores;
CREATE POLICY alwayson_fornecedor_distribuidores_admin_write
  ON alwayson_fornecedor_distribuidores FOR INSERT TO authenticated
  WITH CHECK (public.current_user_is_admin());

DROP POLICY IF EXISTS alwayson_fornecedor_distribuidores_admin_update ON alwayson_fornecedor_distribuidores;
CREATE POLICY alwayson_fornecedor_distribuidores_admin_update
  ON alwayson_fornecedor_distribuidores FOR UPDATE TO authenticated
  USING (public.current_user_is_admin())
  WITH CHECK (public.current_user_is_admin());

DROP POLICY IF EXISTS alwayson_fornecedor_distribuidores_admin_delete ON alwayson_fornecedor_distribuidores;
CREATE POLICY alwayson_fornecedor_distribuidores_admin_delete
  ON alwayson_fornecedor_distribuidores FOR DELETE TO authenticated
  USING (public.current_user_is_admin());
