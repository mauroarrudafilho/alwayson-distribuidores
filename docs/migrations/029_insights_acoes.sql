-- Migration 029 — fila de ações por cliente Arruda dentro do tenant.
-- Permite ao distribuidor marcar clientes do histórico fechado Arruda 2022–2024
-- como tratados, em ação, snooze ou arquivados — sem mexer no dataset original.
--
-- Projeto canônico: osukbalwykbqvoumddxz

-- ─── 1. Tabela ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS alwayson_insights_acoes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES alwayson_tenants(id) ON DELETE CASCADE,
  cnpj_cliente    text NOT NULL,
  estado          text NOT NULL DEFAULT 'pendente'
                  CHECK (estado IN ('pendente','em_acao','resolvido','snooze','arquivado')),
  motivo          text,
  snooze_until    date,
  criado_por      uuid REFERENCES auth.users(id),
  atualizado_por  uuid REFERENCES auth.users(id),
  criado_em       timestamptz NOT NULL DEFAULT now(),
  atualizado_em   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, cnpj_cliente)
);

COMMENT ON TABLE alwayson_insights_acoes IS
  'Estado de ação por cliente Arruda dentro de cada tenant. Permite gerir o backlog de recuperação derivado do histórico Arruda 2022–2024.';

COMMENT ON COLUMN alwayson_insights_acoes.cnpj_cliente IS
  'CNPJ do cliente conforme normatizado em alwayson_insights_nf (14 dígitos).';

CREATE INDEX IF NOT EXISTS idx_alwayson_insights_acoes_tenant
  ON alwayson_insights_acoes (tenant_id);

CREATE INDEX IF NOT EXISTS idx_alwayson_insights_acoes_cnpj
  ON alwayson_insights_acoes (cnpj_cliente);

CREATE INDEX IF NOT EXISTS idx_alwayson_insights_acoes_state
  ON alwayson_insights_acoes (tenant_id, estado);

-- ─── 2. Trigger touch ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_alwayson_insights_acoes_touch()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.atualizado_em := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_alwayson_insights_acoes_touch
  ON alwayson_insights_acoes;
CREATE TRIGGER trg_alwayson_insights_acoes_touch
BEFORE UPDATE ON alwayson_insights_acoes
FOR EACH ROW EXECUTE FUNCTION public.fn_alwayson_insights_acoes_touch();

-- ─── 3. RLS ─────────────────────────────────────────────────────────────────

ALTER TABLE alwayson_insights_acoes ENABLE ROW LEVEL SECURITY;

-- SELECT: membro ativo do tenant ou admin global.
DROP POLICY IF EXISTS alwayson_insights_acoes_member_select ON alwayson_insights_acoes;
CREATE POLICY alwayson_insights_acoes_member_select
  ON alwayson_insights_acoes FOR SELECT TO authenticated
  USING (
    public.current_user_is_admin()
    OR tenant_id IN (
      SELECT m.tenant_id FROM alwayson_memberships m
      WHERE m.user_id = auth.uid() AND m.ativo = true
    )
  );

-- INSERT: idem.
DROP POLICY IF EXISTS alwayson_insights_acoes_member_insert ON alwayson_insights_acoes;
CREATE POLICY alwayson_insights_acoes_member_insert
  ON alwayson_insights_acoes FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_is_admin()
    OR tenant_id IN (
      SELECT m.tenant_id FROM alwayson_memberships m
      WHERE m.user_id = auth.uid() AND m.ativo = true
    )
  );

-- UPDATE: idem.
DROP POLICY IF EXISTS alwayson_insights_acoes_member_update ON alwayson_insights_acoes;
CREATE POLICY alwayson_insights_acoes_member_update
  ON alwayson_insights_acoes FOR UPDATE TO authenticated
  USING (
    public.current_user_is_admin()
    OR tenant_id IN (
      SELECT m.tenant_id FROM alwayson_memberships m
      WHERE m.user_id = auth.uid() AND m.ativo = true
    )
  )
  WITH CHECK (
    public.current_user_is_admin()
    OR tenant_id IN (
      SELECT m.tenant_id FROM alwayson_memberships m
      WHERE m.user_id = auth.uid() AND m.ativo = true
    )
  );

-- DELETE: idem (preparado para o caso de "limpar histórico de ação"; UI usa arquivado).
DROP POLICY IF EXISTS alwayson_insights_acoes_member_delete ON alwayson_insights_acoes;
CREATE POLICY alwayson_insights_acoes_member_delete
  ON alwayson_insights_acoes FOR DELETE TO authenticated
  USING (
    public.current_user_is_admin()
    OR tenant_id IN (
      SELECT m.tenant_id FROM alwayson_memberships m
      WHERE m.user_id = auth.uid() AND m.ativo = true
    )
  );
