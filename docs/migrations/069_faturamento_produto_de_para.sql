-- Migration 069 — de-para de SKU órfão (faturamento → catálogo), curadoria em /admin/produtos.
--
-- Mesma forma do de-para do Insights (migration 011): tabela global (sem
-- distribuidor_id — um SKU físico é o mesmo produto em qualquer distribuidor),
-- resolução por LEFT JOIN na leitura, nunca escrita em alwayson_faturamento_itens.
-- Só alias: sku_fornecedor precisa já existir em alwayson_produtos (FK).
--
-- RLS mais restrita que o precedente do Insights (que é aberto a qualquer
-- authenticated): a leitura segue o escopo por fornecedor da migration 048, e a
-- escrita é limitada a admin global + gestor_fornecedor do fornecedor dono do
-- SKU alvo — segue o padrão de current_user_*_escopo_ok() da migration 061.
--
-- Projeto canônico: osukbalwykbqvoumddxz

CREATE TABLE IF NOT EXISTS alwayson_faturamento_produto_de_para (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku_origem     text NOT NULL UNIQUE,
  sku_fornecedor text NOT NULL REFERENCES alwayson_produtos(sku) ON UPDATE CASCADE ON DELETE RESTRICT,
  criado_por     uuid REFERENCES auth.users(id),
  criado_em      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_faturamento_de_para_sku_fornecedor
  ON alwayson_faturamento_produto_de_para (sku_fornecedor);

COMMENT ON TABLE alwayson_faturamento_produto_de_para IS
  'Mapeamento SKU de origem (faturamento_itens.sku sem produto_id) → SKU oficial em alwayson_produtos. Global por fornecedor, sem distribuidor_id.';
COMMENT ON COLUMN alwayson_faturamento_produto_de_para.sku_origem IS
  'Valor de alwayson_faturamento_itens.sku para linhas com produto_id NULL.';
COMMENT ON COLUMN alwayson_faturamento_produto_de_para.sku_fornecedor IS
  'SKU único oficial; FK a alwayson_produtos.sku. Nunca cria produto novo — só alias.';

ALTER TABLE alwayson_faturamento_produto_de_para ENABLE ROW LEVEL SECURITY;

-- Helper: admin global OU gestor_fornecedor do fornecedor dono de p_sku_fornecedor.
CREATE OR REPLACE FUNCTION public.current_user_sku_fornecedor_gestor_ok(p_sku_fornecedor text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.current_user_is_admin()
    OR EXISTS (
      SELECT 1
      FROM alwayson_produtos p
      JOIN alwayson_memberships m ON m.tenant_id = p.fornecedor_tenant_id
      WHERE p.sku = p_sku_fornecedor
        AND m.user_id = auth.uid()
        AND m.ativo
        AND m.role = 'gestor_fornecedor'
    );
$$;

COMMENT ON FUNCTION public.current_user_sku_fornecedor_gestor_ok(text) IS
  'Autoriza escrita no de-para de produto quando o utilizador é admin global ou gestor do fornecedor dono do SKU alvo.';

REVOKE ALL ON FUNCTION public.current_user_sku_fornecedor_gestor_ok(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_sku_fornecedor_gestor_ok(text) TO authenticated;

CREATE POLICY alwayson_faturamento_produto_de_para_select_escopo
  ON alwayson_faturamento_produto_de_para FOR SELECT TO authenticated
  USING (
    public.current_user_is_admin()
    OR EXISTS (
      SELECT 1 FROM alwayson_produtos p
      WHERE p.sku = alwayson_faturamento_produto_de_para.sku_fornecedor
        AND p.fornecedor_tenant_id IN (SELECT f.tenant_id FROM public.current_user_fornecedores_visiveis() f)
    )
  );

CREATE POLICY alwayson_faturamento_produto_de_para_insert_escopo
  ON alwayson_faturamento_produto_de_para FOR INSERT TO authenticated
  WITH CHECK (public.current_user_sku_fornecedor_gestor_ok(sku_fornecedor));

CREATE POLICY alwayson_faturamento_produto_de_para_delete_escopo
  ON alwayson_faturamento_produto_de_para FOR DELETE TO authenticated
  USING (public.current_user_sku_fornecedor_gestor_ok(sku_fornecedor));

-- View de pendentes: SKU faturado sem produto_id resolvido e sem alias ainda.
-- Agrupa só por sku (não por descricao) — a mesma SKU pode ter descricao
-- diferente entre uploads (achado em 2026-08-11); usa a mais recente (por
-- data de emissão da nota) como referência de exibição.
CREATE VIEW alwayson_faturamento_v_produtos_nao_mapeados
WITH (security_invoker = true) AS
SELECT
  i.sku,
  (array_agg(i.descricao ORDER BY f.data_emissao DESC))[1] AS descricao,
  sum(i.valor_total) AS faturamento_total,
  count(*) AS total_linhas
FROM alwayson_faturamento_itens i
JOIN alwayson_faturamento f ON f.id = i.faturamento_id
WHERE i.produto_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM alwayson_faturamento_produto_de_para d
    WHERE d.sku_origem = i.sku
  )
GROUP BY i.sku;

COMMENT ON VIEW alwayson_faturamento_v_produtos_nao_mapeados IS
  'SKUs faturados sem produto_id resolvido e sem alias no de-para — fila de curadoria em /admin/produtos.';
