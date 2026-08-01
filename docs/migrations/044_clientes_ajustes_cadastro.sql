-- Migration 044 — histórico real de ajustes de cadastro do cliente
-- (substitui o mock em memória `src/hooks/useMockAjustesCadastro.ts`).
--
-- Registra mudanças pontuais no cadastro de um cliente (CNPJ, razão social,
-- nome fantasia, endereço, vendedor responsável) com motivo e auditoria —
-- sem alterar `alwayson_clientes_distribuidor` em si. "Reverter" é lógico
-- (preenche reverted_em/reverted_por), nunca deleta a linha.
--
-- Projeto canônico: osukbalwykbqvoumddxz

-- ─── 1. Tabela ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS alwayson_clientes_ajustes_cadastro (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id      uuid NOT NULL REFERENCES alwayson_clientes_distribuidor(id) ON DELETE CASCADE,
  tipo            text NOT NULL CHECK (tipo IN
                  ('cnpj','razao_social','nome_fantasia','endereco','vendedor','outro')),
  valor_anterior  text NOT NULL,
  valor_atual     text NOT NULL,
  motivo          text NOT NULL CHECK (motivo IN
                  ('mudanca_societaria','matriz_filial','erro_cadastro','atualizacao',
                   'rebranding','desligamento','outro')),
  observacao      text,
  criado_por      uuid REFERENCES auth.users(id),
  criado_em       timestamptz NOT NULL DEFAULT now(),
  reverted_em     timestamptz,
  reverted_por    uuid REFERENCES auth.users(id)
);

COMMENT ON TABLE alwayson_clientes_ajustes_cadastro IS
  'Histórico auditável de ajustes pontuais no cadastro de um cliente (CNPJ, razão social, endereço, vendedor). Reversão é lógica (reverted_em), nunca DELETE.';

CREATE INDEX IF NOT EXISTS idx_clientes_ajustes_cadastro_cliente
  ON alwayson_clientes_ajustes_cadastro (cliente_id);

CREATE INDEX IF NOT EXISTS idx_clientes_ajustes_cadastro_criado_em
  ON alwayson_clientes_ajustes_cadastro (criado_em DESC);

-- ─── 2. RLS ─────────────────────────────────────────────────────────────────
-- SELECT: qualquer autenticado (mesmo padrão de alwayson_clientes_distribuidor).
-- INSERT/UPDATE (registrar/reverter): só admin global — ajuste de cadastro é
-- uma ação sensível de auditoria, mesmo padrão usado em alwayson_distribuidores
-- (migration 035) e alwayson_tenants/memberships (migration 028).

ALTER TABLE alwayson_clientes_ajustes_cadastro ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS alwayson_clientes_ajustes_cadastro_select_authenticated
  ON alwayson_clientes_ajustes_cadastro;
CREATE POLICY alwayson_clientes_ajustes_cadastro_select_authenticated
  ON alwayson_clientes_ajustes_cadastro FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS alwayson_clientes_ajustes_cadastro_admin_insert
  ON alwayson_clientes_ajustes_cadastro;
CREATE POLICY alwayson_clientes_ajustes_cadastro_admin_insert
  ON alwayson_clientes_ajustes_cadastro FOR INSERT TO authenticated
  WITH CHECK (public.current_user_is_admin());

DROP POLICY IF EXISTS alwayson_clientes_ajustes_cadastro_admin_update
  ON alwayson_clientes_ajustes_cadastro;
CREATE POLICY alwayson_clientes_ajustes_cadastro_admin_update
  ON alwayson_clientes_ajustes_cadastro FOR UPDATE TO authenticated
  USING (public.current_user_is_admin())
  WITH CHECK (public.current_user_is_admin());
