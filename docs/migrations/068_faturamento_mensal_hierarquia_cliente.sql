-- 068: séries mensais por nível hierárquico e por cliente, para as minisséries
-- por linha da Performance (etapa 2).
--
-- Só faturamento e NFs, de propósito. São aditivos, então rolam pela hierarquia
-- sem mentir. `clientes_positivados` e `skus_distintos` NÃO rolam: um supervisor
-- com quatro vendedores atendendo o mesmo cliente contaria o cliente quatro
-- vezes. Quem precisa de distintos usa alwayson_faturamento_v_mensal (067),
-- onde eles são calculados e não somados.

DROP VIEW IF EXISTS alwayson_faturamento_v_mensal_hierarquia;

CREATE VIEW alwayson_faturamento_v_mensal_hierarquia
WITH (security_invoker = true) AS
WITH RECURSIVE ancestrais AS (
  -- Todo vendedor é ancestral de si próprio…
  SELECT id AS vendedor_id, id AS ancestral_id, tipo AS ancestral_tipo
  FROM alwayson_vendedores_distribuidor
  UNION ALL
  -- …e herda supervisor e, acima dele, gerente.
  SELECT a.vendedor_id, pai.id, pai.tipo
  FROM ancestrais a
  JOIN alwayson_vendedores_distribuidor filho ON filho.id = a.ancestral_id
  JOIN alwayson_vendedores_distribuidor pai   ON pai.id   = filho.supervisor_id
)
SELECT
  f.distribuidor_id,
  f.fornecedor_tenant_id,
  an.ancestral_tipo AS nivel,
  an.ancestral_id   AS entidade_id,
  date_trunc('month', f.data_emissao)::date AS mes,
  sum(f.valor_total)          AS faturamento,
  count(DISTINCT f.numero_nf) AS nfs
FROM alwayson_faturamento f
JOIN ancestrais an ON an.vendedor_id = f.vendedor_id
GROUP BY 1, 2, 3, 4, 5;

COMMENT ON VIEW alwayson_faturamento_v_mensal_hierarquia IS
  'Série mensal de faturamento por nível (gerente/supervisor/vendedor). Só métricas aditivas: distintos não rolam pela hierarquia.';

DROP VIEW IF EXISTS alwayson_faturamento_v_mensal_cliente;

CREATE VIEW alwayson_faturamento_v_mensal_cliente
WITH (security_invoker = true) AS
SELECT
  f.distribuidor_id,
  f.fornecedor_tenant_id,
  f.cliente_id,
  date_trunc('month', f.data_emissao)::date AS mes,
  sum(f.valor_total)          AS faturamento,
  count(DISTINCT f.numero_nf) AS nfs
FROM alwayson_faturamento f
GROUP BY 1, 2, 3, 4;

COMMENT ON VIEW alwayson_faturamento_v_mensal_cliente IS
  'Série mensal de faturamento por cliente, para a minissérie da aba Cliente.';
