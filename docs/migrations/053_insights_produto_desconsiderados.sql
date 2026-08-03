-- Códigos Insights marcados como fora do mix (sem vínculo a alwayson_produtos).
-- Sai da fila de "não mapeados" sem inventar SKU fictício.
--
-- Projeto canônico: osukbalwykbqvoumddxz

CREATE TABLE IF NOT EXISTS alwayson_insights_produto_desconsiderados (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_origem  text NOT NULL,
  motivo         text,
  criado_em      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (codigo_origem)
);

CREATE INDEX IF NOT EXISTS idx_insights_prod_desconsiderados_codigo
  ON alwayson_insights_produto_desconsiderados (codigo_origem);

COMMENT ON TABLE alwayson_insights_produto_desconsiderados IS
  'Códigos da base Insights (Nordeste) explicitamente fora do mix indústria — não entram em alwayson_insights_v_produtos.';
COMMENT ON COLUMN alwayson_insights_produto_desconsiderados.codigo_origem IS
  'Mesma chave usada em alwayson_insights_produto_de_para.codigo_origem (codprod_fornecedor ou sku da linha).';

ALTER TABLE alwayson_insights_produto_desconsiderados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS alwayson_insights_produto_desconsiderados_select_authenticated
  ON alwayson_insights_produto_desconsiderados;
CREATE POLICY alwayson_insights_produto_desconsiderados_select_authenticated
  ON alwayson_insights_produto_desconsiderados
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS alwayson_insights_produto_desconsiderados_write_authenticated
  ON alwayson_insights_produto_desconsiderados;
CREATE POLICY alwayson_insights_produto_desconsiderados_write_authenticated
  ON alwayson_insights_produto_desconsiderados
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Atualiza a fila de pendentes: exclui códigos desconsiderados.
DROP VIEW IF EXISTS alwayson_insights_v_produtos_nao_mapeados CASCADE;

CREATE VIEW alwayson_insights_v_produtos_nao_mapeados AS
WITH linhas AS (
  SELECT
    COALESCE(
      NULLIF(TRIM(BOTH FROM itens.codprod_fornecedor), ''),
      NULLIF(TRIM(BOTH FROM itens.sku), '')
    ) AS codigo_origem,
    TRIM(BOTH FROM itens.sku) AS sku_linha,
    NULLIF(TRIM(BOTH FROM itens.descricao), '') AS descricao_linha,
    COALESCE(d1.sku_fornecedor, d2.sku_fornecedor, TRIM(BOTH FROM itens.sku)) AS sku_resolvido,
    p.sku AS sku_industria,
    itens.valor_total,
    itens.quantidade
  FROM alwayson_insights_nf_itens itens
  JOIN alwayson_insights_nf nf ON nf.id = itens.nf_id
  JOIN alwayson_insights_clientes ic ON ic.cnpj_14 = nf.cnpj_cliente
  LEFT JOIN alwayson_insights_produto_de_para d1
    ON NULLIF(TRIM(BOTH FROM itens.codprod_fornecedor), '') IS NOT NULL
   AND d1.codigo_origem = NULLIF(TRIM(BOTH FROM itens.codprod_fornecedor), '')
  LEFT JOIN alwayson_insights_produto_de_para d2
    ON d1.sku_fornecedor IS NULL
   AND d2.codigo_origem = TRIM(BOTH FROM itens.sku)
  LEFT JOIN alwayson_produtos p
    ON p.sku = COALESCE(d1.sku_fornecedor, d2.sku_fornecedor, TRIM(BOTH FROM itens.sku))
  WHERE UPPER(TRIM(ic.estado)) IN ('AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE')
)
SELECT
  codigo_origem,
  max(sku_linha) AS sku_exemplo,
  max(descricao_linha) AS descricao,
  max(sku_resolvido) AS sku_resolvido_atual,
  sum(valor_total) AS faturamento_total,
  sum(quantidade) AS quantidade_total,
  count(*)::bigint AS total_linhas
FROM linhas
WHERE sku_industria IS NULL
  AND codigo_origem IS NOT NULL
  AND codigo_origem <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM alwayson_insights_produto_desconsiderados ign
    WHERE ign.codigo_origem = linhas.codigo_origem
  )
GROUP BY codigo_origem;

COMMENT ON VIEW alwayson_insights_v_produtos_nao_mapeados IS
  'Códigos Insights (Nordeste) sem SKU no cadastro alwayson_produtos — candidatos a de-para (exclui desconsiderados).';

GRANT SELECT ON alwayson_insights_v_produtos_nao_mapeados TO anon, authenticated;
