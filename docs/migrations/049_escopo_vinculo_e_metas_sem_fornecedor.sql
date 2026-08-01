-- Migration 049 — fecha duas brechas abertas pela 048.
--
-- 1. `alwayson_fornecedor_distribuidores` continuava com `USING (true)`: é o
--    mapa de quem trabalha com quem, e expõe a relação comercial de terceiros.
--    Passa a seguir a mesma regra de dois eixos das tabelas transacionais.
--
-- 2. Meta gravada pela UI ficava sem `fornecedor_tenant_id`, e como
--    `NULL IN (...)` é NULL, a linha nasceria invisível para todo não-admin.
--    Falha fechada — não vaza —, mas silenciosa. O default resolve enquanto o
--    distribuidor tem um fornecedor só; com dois, a aplicação passa a ser
--    obrigada a informar qual.
--
-- Projeto canônico: osukbalwykbqvoumddxz

-- ─── 1. Escopo do mapa de relação ───────────────────────────────────────────

DROP POLICY IF EXISTS alwayson_fornecedor_distribuidores_select_authenticated
  ON alwayson_fornecedor_distribuidores;
DROP POLICY IF EXISTS alwayson_fornecedor_distribuidores_select_escopo
  ON alwayson_fornecedor_distribuidores;
CREATE POLICY alwayson_fornecedor_distribuidores_select_escopo
  ON alwayson_fornecedor_distribuidores FOR SELECT TO authenticated
  USING (
    public.current_user_is_admin()
    OR (
      distribuidor_id      IN (SELECT d.distribuidor_id FROM public.current_user_distribuidores_visiveis() d)
      AND fornecedor_tenant_id IN (SELECT f.tenant_id  FROM public.current_user_fornecedores_visiveis() f)
    )
  );

-- ─── 2. Fornecedor da meta ──────────────────────────────────────────────────
-- Resolve o fornecedor a partir da relação comercial quando há exatamente um
-- para aquele distribuidor. Com mais de um, deixa NULL de propósito: quem grava
-- precisa escolher, e o erro aparece na UI em vez de virar linha órfã.

CREATE OR REPLACE FUNCTION public.fn_alwayson_metas_default_fornecedor()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_qtd integer;
BEGIN
  IF NEW.fornecedor_tenant_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_qtd
  FROM alwayson_fornecedor_distribuidores
  WHERE distribuidor_id = NEW.distribuidor_id AND ativo;

  IF v_qtd = 1 THEN
    SELECT fornecedor_tenant_id INTO NEW.fornecedor_tenant_id
    FROM alwayson_fornecedor_distribuidores
    WHERE distribuidor_id = NEW.distribuidor_id AND ativo;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_alwayson_metas_default_fornecedor ON alwayson_metas_distribuidor;
CREATE TRIGGER trg_alwayson_metas_default_fornecedor
BEFORE INSERT ON alwayson_metas_distribuidor
FOR EACH ROW EXECUTE FUNCTION public.fn_alwayson_metas_default_fornecedor();

COMMENT ON FUNCTION public.fn_alwayson_metas_default_fornecedor() IS
  'Carimba o fornecedor da meta quando o distribuidor tem só um. Com vários, mantém NULL para a aplicação ser obrigada a escolher.';
