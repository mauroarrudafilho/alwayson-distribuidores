-- Redes Insights: agrupamento automático (raiz CNPJ = 8 primeiros dígitos) e redes manuais (admin).
-- Pré-requisitos: 015_insights_clientes_dim.sql, 018 (current_user_is_admin), 019 RLS.
-- Projeto canônico: osukbalwykbqvoumddxz

-- ─── 1. Tabelas ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS alwayson_insights_redes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome            text NOT NULL,
  criado_em       timestamptz NOT NULL DEFAULT now(),
  atualizado_em   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE alwayson_insights_redes IS
  'Rede manual (Insights). CNPJs vinculados em alwayson_insights_rede_membros; precedência sobre agrupamento por raiz.';

CREATE TABLE IF NOT EXISTS alwayson_insights_rede_membros (
  rede_id    uuid NOT NULL REFERENCES alwayson_insights_redes(id) ON DELETE CASCADE,
  cnpj_14    text NOT NULL REFERENCES alwayson_insights_clientes(cnpj_14) ON DELETE CASCADE,
  criado_em  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (rede_id, cnpj_14),
  CONSTRAINT alwayson_insights_rede_membros_cnpj_unique UNIQUE (cnpj_14)
);

COMMENT ON TABLE alwayson_insights_rede_membros IS
  'Um CNPJ de estabelecimento pertence a no máximo uma rede manual.';

CREATE INDEX IF NOT EXISTS idx_insights_rede_membros_rede
  ON alwayson_insights_rede_membros (rede_id);

-- ─── 2. Touch atualizado_em ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_alwayson_insights_redes_touch()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.atualizado_em := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_alwayson_insights_redes_touch ON alwayson_insights_redes;
CREATE TRIGGER trg_alwayson_insights_redes_touch
  BEFORE UPDATE ON alwayson_insights_redes
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_alwayson_insights_redes_touch();

REVOKE ALL ON FUNCTION public.fn_alwayson_insights_redes_touch() FROM PUBLIC;

-- ─── 3. Views analíticas ─────────────────────────────────────────────────────

CREATE OR REPLACE VIEW alwayson_insights_v_clientes_com_rede AS
SELECT
  v.cnpj_cliente,
  v.nome_cliente,
  v.razao_social,
  v.cidade,
  v.estado,
  v.faturamento_total,
  v.total_nfs,
  v.ultima_compra,
  v.total_skus,
  SUBSTRING(v.cnpj_cliente, 1, 8) AS cnpj_raiz,
  m.rede_id,
  r.nome AS rede_nome,
  CASE
    WHEN m.rede_id IS NOT NULL THEN 'manual'::text
    ELSE 'raiz'::text
  END AS grupo_kind,
  COALESCE(m.rede_id::text, 'auto:' || SUBSTRING(v.cnpj_cliente, 1, 8)) AS grupo_id,
  CASE
    WHEN m.rede_id IS NOT NULL THEN r.nome
    ELSE
      SUBSTRING(v.cnpj_cliente, 1, 2) || '.'
      || SUBSTRING(v.cnpj_cliente, 3, 3) || '.'
      || SUBSTRING(v.cnpj_cliente, 6, 3)
  END AS grupo_label
FROM alwayson_insights_v_clientes v
LEFT JOIN alwayson_insights_rede_membros m ON m.cnpj_14 = v.cnpj_cliente
LEFT JOIN alwayson_insights_redes r ON r.id = m.rede_id;

COMMENT ON VIEW alwayson_insights_v_clientes_com_rede IS
  'Clientes Insights com grupo efetivo (rede manual ou raiz CNPJ).';

CREATE OR REPLACE VIEW alwayson_insights_v_rede_resumo AS
WITH nf_grupo AS (
  SELECT
    nf.id           AS nf_id,
    nf.cnpj_cliente,
    nf.data_emissao,
    CASE
      WHEN m.rede_id IS NOT NULL THEN 'manual'::text
      ELSE 'raiz'::text
    END AS grupo_kind,
    COALESCE(m.rede_id::text, 'auto:' || SUBSTRING(nf.cnpj_cliente, 1, 8)) AS grupo_id,
    CASE
      WHEN m.rede_id IS NOT NULL THEN r.nome
      ELSE
        SUBSTRING(nf.cnpj_cliente, 1, 2) || '.'
        || SUBSTRING(nf.cnpj_cliente, 3, 3) || '.'
        || SUBSTRING(nf.cnpj_cliente, 6, 3)
    END AS grupo_label_raw
  FROM alwayson_insights_nf nf
  LEFT JOIN alwayson_insights_rede_membros m ON m.cnpj_14 = nf.cnpj_cliente
  LEFT JOIN alwayson_insights_redes r ON r.id = m.rede_id
)
SELECT
  g.grupo_kind,
  g.grupo_id,
  MAX(g.grupo_label_raw) AS grupo_label,
  COUNT(DISTINCT g.cnpj_cliente) AS total_lojas,
  COALESCE(SUM(itens.valor_total), 0) AS faturamento_total,
  COUNT(DISTINCT g.nf_id) AS total_nfs,
  MAX(g.data_emissao) AS ultima_compra,
  COUNT(DISTINCT itens.sku) AS total_skus,
  CASE
    WHEN COUNT(DISTINCT g.cnpj_cliente) > 0
      THEN COALESCE(SUM(itens.valor_total), 0) / COUNT(DISTINCT g.cnpj_cliente)
    ELSE 0
  END AS ticket_medio_loja
FROM nf_grupo g
LEFT JOIN alwayson_insights_nf_itens itens ON itens.nf_id = g.nf_id
GROUP BY g.grupo_kind, g.grupo_id;

COMMENT ON VIEW alwayson_insights_v_rede_resumo IS
  'Sell-out agregado por rede (manual ou raiz CNPJ).';

-- ─── 4. RLS ─────────────────────────────────────────────────────────────────

ALTER TABLE alwayson_insights_redes ENABLE ROW LEVEL SECURITY;
ALTER TABLE alwayson_insights_rede_membros ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS alwayson_insights_redes_select_authenticated ON alwayson_insights_redes;
CREATE POLICY alwayson_insights_redes_select_authenticated
  ON alwayson_insights_redes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS alwayson_insights_rede_membros_select_authenticated ON alwayson_insights_rede_membros;
CREATE POLICY alwayson_insights_rede_membros_select_authenticated
  ON alwayson_insights_rede_membros FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS alwayson_insights_redes_admin_insert ON alwayson_insights_redes;
CREATE POLICY alwayson_insights_redes_admin_insert
  ON alwayson_insights_redes FOR INSERT TO authenticated
  WITH CHECK (public.current_user_is_admin());

DROP POLICY IF EXISTS alwayson_insights_redes_admin_update ON alwayson_insights_redes;
CREATE POLICY alwayson_insights_redes_admin_update
  ON alwayson_insights_redes FOR UPDATE TO authenticated
  USING (public.current_user_is_admin())
  WITH CHECK (public.current_user_is_admin());

DROP POLICY IF EXISTS alwayson_insights_redes_admin_delete ON alwayson_insights_redes;
CREATE POLICY alwayson_insights_redes_admin_delete
  ON alwayson_insights_redes FOR DELETE TO authenticated
  USING (public.current_user_is_admin());

DROP POLICY IF EXISTS alwayson_insights_rede_membros_admin_insert ON alwayson_insights_rede_membros;
CREATE POLICY alwayson_insights_rede_membros_admin_insert
  ON alwayson_insights_rede_membros FOR INSERT TO authenticated
  WITH CHECK (public.current_user_is_admin());

DROP POLICY IF EXISTS alwayson_insights_rede_membros_admin_update ON alwayson_insights_rede_membros;
CREATE POLICY alwayson_insights_rede_membros_admin_update
  ON alwayson_insights_rede_membros FOR UPDATE TO authenticated
  USING (public.current_user_is_admin())
  WITH CHECK (public.current_user_is_admin());

DROP POLICY IF EXISTS alwayson_insights_rede_membros_admin_delete ON alwayson_insights_rede_membros;
CREATE POLICY alwayson_insights_rede_membros_admin_delete
  ON alwayson_insights_rede_membros FOR DELETE TO authenticated
  USING (public.current_user_is_admin());

-- ─── 5. Grants ───────────────────────────────────────────────────────────────

GRANT SELECT ON alwayson_insights_redes TO authenticated;
GRANT SELECT ON alwayson_insights_rede_membros TO authenticated;
GRANT INSERT, UPDATE, DELETE ON alwayson_insights_redes TO authenticated;
GRANT INSERT, UPDATE, DELETE ON alwayson_insights_rede_membros TO authenticated;

GRANT SELECT ON alwayson_insights_v_clientes_com_rede TO authenticated;
GRANT SELECT ON alwayson_insights_v_rede_resumo TO authenticated;
