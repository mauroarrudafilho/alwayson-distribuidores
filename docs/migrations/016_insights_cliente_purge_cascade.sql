-- Exclusão de cliente Insights (CNPJ): remove sempreon_insights_clientes + NFs + itens (CASCADE).
-- UI admin chama RPC public.insights_delete_cliente_e_nfs(cnpj, secret); o secret deve ser trocado
-- em alwayson_insights_purge_config (SQL Editor).
--
-- Projeto canônico: osukbalwykbqvoumddxz

-- ─── 1. FK nf → cliente com CASCADE ────────────────────────────────────────

ALTER TABLE alwayson_insights_nf
  DROP CONSTRAINT IF EXISTS alwayson_insights_nf_cnpj_cliente_fkey;

ALTER TABLE alwayson_insights_nf
  ADD CONSTRAINT alwayson_insights_nf_cnpj_cliente_fkey
  FOREIGN KEY (cnpj_cliente)
  REFERENCES alwayson_insights_clientes (cnpj_14)
  ON DELETE CASCADE;

COMMENT ON CONSTRAINT alwayson_insights_nf_cnpj_cliente_fkey ON alwayson_insights_nf IS
  'Apagar cliente remove todas as alwayson_insights_nf (e itens) desse CNPJ.';

-- ─── 2. Segredo só em tabela não exposta ao PostgREST (RLS fecha leituras) ─────

CREATE TABLE IF NOT EXISTS alwayson_insights_purge_config (
  id     int PRIMARY KEY CHECK (id = 1),
  secret text NOT NULL
);

COMMENT ON TABLE alwayson_insights_purge_config IS
  'Segredo textual para RPC insights_delete_cliente_e_nfs. Troque UPDATE id=1 no SQL Editor.';

ALTER TABLE alwayson_insights_purge_config ENABLE ROW LEVEL SECURITY;

-- Sem políticas → anon/authenticated não leem gravam pela API; RPC SECURITY DEFINER lê dentro da função.

INSERT INTO alwayson_insights_purge_config (id, secret)
VALUES (
  1,
  'troque-este-valor-no-sql-editor-antes-de-usar-o-painel'
)
ON CONFLICT (id) DO NOTHING;

-- ─── 3. RPC (SECURITY DEFINER) ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.insights_delete_cliente_e_nfs(p_cnpj_14 text, p_secret text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  exp     text;
  n       int;
  c_digits text := regexp_replace(coalesce(p_cnpj_14, ''), '\D', '', 'g');
  c_clean text;
BEGIN
  IF length(c_digits) >= 14 THEN
    c_clean := right(c_digits, 14);
  ELSE
    c_clean := lpad(c_digits, 14, '0');
  END IF;

  IF c_clean !~ '^[0-9]{14}$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'cnpj_invalido');
  END IF;

  SELECT c.secret INTO exp FROM alwayson_insights_purge_config c WHERE c.id = 1;
  IF exp IS NULL OR coalesce(trim(p_secret), '') = '' OR p_secret IS DISTINCT FROM exp THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  DELETE FROM alwayson_insights_clientes WHERE cnpj_14 = c_clean;
  GET DIAGNOSTICS n = ROW_COUNT;

  IF n = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'nao_encontrado', 'cnpj_14', c_clean);
  END IF;

  RETURN jsonb_build_object('ok', true, 'cnpj_14', c_clean, 'removidos', n);
END;
$$;

COMMENT ON FUNCTION public.insights_delete_cliente_e_nfs(text, text) IS
  'Exclui sempreon_insights_clientes pelo CNPJ 14 dígitos; FK CASCADE apaga todas as NF e itens ligados.';

REVOKE ALL ON FUNCTION public.insights_delete_cliente_e_nfs(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.insights_delete_cliente_e_nfs(text, text) TO anon, authenticated;
