-- Migration 070 — view mensal por SKU e vendedor para a aba Produtos da Performance.
--
-- Grão (distribuidor_id, fornecedor_tenant_id, vendedor_id, sku, mes). Nome do
-- produto resolvido em cascata: produto_id direto (91% das linhas, já resolvido
-- na ingestão) → alwayson_faturamento_produto_de_para (migration 069, alias
-- manual) → descricao crua do item. Nunca fica sem nome.
--
-- Validado em 2026-08-12 (sem a Parte B, que ainda não existia): 9.484 linhas,
-- 36 SKUs, faturamento total batendo exato com o controle (R$ 15.104.043,07).
--
-- Projeto canônico: osukbalwykbqvoumddxz

CREATE VIEW alwayson_faturamento_v_mensal_produto
WITH (security_invoker = true) AS
SELECT
  f.distribuidor_id,
  f.fornecedor_tenant_id,
  f.vendedor_id,
  i.sku,
  COALESCE(p_direto.descricao, p_alias.descricao, i.descricao) AS nome_produto,
  date_trunc('month', f.data_emissao)::date AS mes,
  sum(i.valor_total) AS faturamento,
  count(DISTINCT f.numero_nf) AS nfs
FROM alwayson_faturamento f
JOIN alwayson_faturamento_itens i ON i.faturamento_id = f.id
LEFT JOIN alwayson_produtos p_direto ON p_direto.id = i.produto_id
LEFT JOIN alwayson_faturamento_produto_de_para depara
  ON depara.sku_origem = i.sku AND i.produto_id IS NULL
LEFT JOIN alwayson_produtos p_alias ON p_alias.sku = depara.sku_fornecedor
GROUP BY 1, 2, 3, 4, 5, 6;

COMMENT ON VIEW alwayson_faturamento_v_mensal_produto IS
  'Série mensal de faturamento por SKU e vendedor, para a aba Produtos da Performance (src/pages/performance/ProdutoTab.tsx).';
