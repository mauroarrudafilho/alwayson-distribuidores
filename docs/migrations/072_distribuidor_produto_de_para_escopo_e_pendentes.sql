-- Migration 072 — RLS de escrita por escopo em alwayson_distribuidor_produto_de_para
-- + view de pendentes por distribuidor.
--
-- A policy de escrita desta tabela ficou aberta a qualquer authenticated desde
-- a migration 019 ("Fase 1 permissiva"), nunca fechada na Fase 2 (a migration
-- 043 já sinalizava isso como dívida técnica conhecida, sem corrigir). Como
-- este trabalho entrega uma tela nova que facilita escrever ali (seção "SKUs
-- não mapeados" em AdminDeParaProdutos.tsx), fechar o RLS agora é
-- pré-requisito, não escopo extra — do contrário a tela nova amplia o buraco
-- existente.
--
-- Projeto canônico: osukbalwykbqvoumddxz

DROP POLICY IF EXISTS alwayson_distribuidor_produto_de_para_write_authenticated
  ON alwayson_distribuidor_produto_de_para;

CREATE POLICY alwayson_distribuidor_produto_de_para_write_escopo
  ON alwayson_distribuidor_produto_de_para
  FOR ALL
  TO authenticated
  USING (public.current_user_distribuidor_escopo_ok(distribuidor_id))
  WITH CHECK (public.current_user_distribuidor_escopo_ok(distribuidor_id));

-- View de pendentes por distribuidor: mesma forma da view global
-- (alwayson_faturamento_v_produtos_nao_mapeados, migration 069), mas o
-- GROUP BY inclui distribuidor_id e o anti-join é contra
-- alwayson_distribuidor_produto_de_para (código bruto do próprio
-- distribuidor), não contra o de-para global de fornecedor.
CREATE VIEW alwayson_faturamento_v_distribuidor_produtos_nao_mapeados
WITH (security_invoker = true) AS
SELECT
  f.distribuidor_id,
  i.sku,
  (array_agg(i.descricao ORDER BY f.data_emissao DESC))[1] AS descricao,
  sum(i.valor_total) AS faturamento_total,
  count(*) AS total_linhas
FROM alwayson_faturamento_itens i
JOIN alwayson_faturamento f ON f.id = i.faturamento_id
WHERE i.produto_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM alwayson_distribuidor_produto_de_para d
    WHERE d.distribuidor_id = f.distribuidor_id AND d.codigo_cliente = i.sku
  )
GROUP BY f.distribuidor_id, i.sku;

COMMENT ON VIEW alwayson_faturamento_v_distribuidor_produtos_nao_mapeados IS
  'SKUs (códigos brutos do distribuidor) faturados sem produto_id resolvido e sem entrada no de-para por distribuidor — fila de curadoria em /admin/distribuidores/:id/de-para-produtos.';
