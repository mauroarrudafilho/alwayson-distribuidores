-- Migration 071 — criado_por default + auditoria reforçada no de-para de produto (fix de revisão final).
--
-- A revisão final do branch encontrou: (1) criado_por nunca era populado (sem
-- DEFAULT, hooks não setam) e não era travado pelo WITH CHECK, permitindo um
-- cliente hand-rolled gravar um uuid arbitrário; (2) o hook usava .upsert()
-- mas a tabela só tem policy de INSERT — ON CONFLICT DO UPDATE falha com RLS
-- "42501" mesmo para admin (corrigido no código do hook, não aqui).
--
-- Projeto canônico: osukbalwykbqvoumddxz

ALTER TABLE alwayson_faturamento_produto_de_para
  ALTER COLUMN criado_por SET DEFAULT auth.uid();

DROP POLICY IF EXISTS alwayson_faturamento_produto_de_para_insert_escopo ON alwayson_faturamento_produto_de_para;
CREATE POLICY alwayson_faturamento_produto_de_para_insert_escopo
  ON alwayson_faturamento_produto_de_para FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_sku_fornecedor_gestor_ok(sku_fornecedor)
    AND (criado_por IS NULL OR criado_por = auth.uid())
  );
