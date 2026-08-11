-- 067: série mensal agregada de faturamento, para a Performance por evolução.
--
-- Por que uma view: a tela precisa de 12–24 meses. Carregar nota a nota são
-- 7.314 NFs e ~16 mil itens só para 12 meses; aqui são ~1.067 linhas no total.
--
-- GROUPING SETS e não uma linha por vendedor: `clientes_positivados` e
-- `skus_distintos` NÃO são aditivos. Em junho/2026 o distribuidor tem 522
-- positivados e 35 SKUs; somar as 54 linhas de vendedor daria 523 e 562.
-- O total tem de ser calculado, nunca derivado.

DROP VIEW IF EXISTS alwayson_faturamento_v_mensal;

CREATE VIEW alwayson_faturamento_v_mensal
WITH (security_invoker = true) AS
WITH base AS (
  SELECT
    f.id,
    f.distribuidor_id,
    f.fornecedor_tenant_id,
    f.vendedor_id,
    f.cliente_id,
    f.numero_nf,
    f.valor_total,
    date_trunc('month', f.data_emissao)::date AS mes
  FROM alwayson_faturamento f
),
notas AS (
  SELECT
    distribuidor_id,
    fornecedor_tenant_id,
    mes,
    vendedor_id,
    GROUPING(vendedor_id) AS g,
    sum(valor_total)              AS faturamento,
    count(DISTINCT numero_nf)     AS nfs,
    count(DISTINCT cliente_id)    AS clientes_positivados
  FROM base
  GROUP BY GROUPING SETS (
    (distribuidor_id, fornecedor_tenant_id, mes, vendedor_id),
    (distribuidor_id, fornecedor_tenant_id, mes)
  )
),
-- CTE separado: o join com itens fan-out uma linha por SKU. Se ele entrasse
-- no cálculo acima, `sum(valor_total)` viria multiplicado.
skus AS (
  SELECT
    b.distribuidor_id,
    b.fornecedor_tenant_id,
    b.mes,
    b.vendedor_id,
    GROUPING(b.vendedor_id) AS g,
    count(DISTINCT i.sku) AS skus_distintos
  FROM base b
  JOIN alwayson_faturamento_itens i ON i.faturamento_id = b.id
  GROUP BY GROUPING SETS (
    (b.distribuidor_id, b.fornecedor_tenant_id, b.mes, b.vendedor_id),
    (b.distribuidor_id, b.fornecedor_tenant_id, b.mes)
  )
)
SELECT
  n.distribuidor_id,
  n.fornecedor_tenant_id,
  n.vendedor_id,
  (n.g = 1) AS eh_total_distribuidor,
  n.mes,
  n.faturamento,
  n.nfs,
  n.clientes_positivados,
  coalesce(s.skus_distintos, 0) AS skus_distintos
FROM notas n
-- IS NOT DISTINCT FROM porque vendedor_id e fornecedor_tenant_id são NULL-áveis
-- e `=` com NULL não casa.
LEFT JOIN skus s
  ON  s.distribuidor_id      IS NOT DISTINCT FROM n.distribuidor_id
  AND s.fornecedor_tenant_id IS NOT DISTINCT FROM n.fornecedor_tenant_id
  AND s.mes                  =  n.mes
  AND s.g                    =  n.g
  AND s.vendedor_id          IS NOT DISTINCT FROM n.vendedor_id;

COMMENT ON VIEW alwayson_faturamento_v_mensal IS
  'Série mensal de sell-in por distribuidor/fornecedor, com linha de total (eh_total_distribuidor) e linha por vendedor. Positivados e SKUs não são aditivos: use a linha de total, nunca a soma.';
