-- Remove dados mock do seed 003 (distribuidores fake + clientes/perf/estoque/etc.).
-- PRESERVA: Insights (alwayson_insights_*), auth/tenants, catálogo alwayson_produtos real.
--
-- Projeto canônico: osukbalwykbqvoumddxz

CREATE TEMP TABLE _seed_dists ON COMMIT DROP AS
SELECT id
FROM alwayson_distribuidores
WHERE id IN (
    'd1000000-0000-0000-0000-000000000001',
    'd1000000-0000-0000-0000-000000000002',
    'd1000000-0000-0000-0000-000000000003'
  )
  OR cnpj IN (
    '12.345.678/0001-01',
    '23.456.789/0001-02',
    '34.567.890/0001-03'
  );

-- Filhos que referenciam faturamento / clientes / vendedores
DELETE FROM alwayson_faturamento_itens
WHERE faturamento_id IN (
  SELECT f.id FROM alwayson_faturamento f
  WHERE f.distribuidor_id IN (SELECT id FROM _seed_dists)
);

DELETE FROM alwayson_faturamento
WHERE distribuidor_id IN (SELECT id FROM _seed_dists);

DELETE FROM alwayson_excelencia_criterios
WHERE cliente_id IN (
  SELECT c.id FROM alwayson_clientes_distribuidor c
  WHERE c.distribuidor_id IN (SELECT id FROM _seed_dists)
);

DELETE FROM alwayson_excelencia_clientes
WHERE distribuidor_id IN (SELECT id FROM _seed_dists);

DELETE FROM alwayson_excelencia_config
WHERE distribuidor_id IN (SELECT id FROM _seed_dists);

DELETE FROM alwayson_performance_periodo
WHERE distribuidor_id IN (SELECT id FROM _seed_dists);

DELETE FROM alwayson_metas_distribuidor
WHERE distribuidor_id IN (SELECT id FROM _seed_dists);

DELETE FROM alwayson_estoque_distribuidor
WHERE distribuidor_id IN (SELECT id FROM _seed_dists);

DELETE FROM alwayson_relatorios_ingestao
WHERE distribuidor_id IN (SELECT id FROM _seed_dists);

DELETE FROM alwayson_distribuidor_produto_de_para
WHERE distribuidor_id IN (SELECT id FROM _seed_dists);

DELETE FROM alwayson_clientes_distribuidor
WHERE distribuidor_id IN (SELECT id FROM _seed_dists);

DELETE FROM alwayson_vendedores_distribuidor
WHERE distribuidor_id IN (SELECT id FROM _seed_dists);

UPDATE alwayson_tenants
SET distribuidor_id = NULL
WHERE distribuidor_id IN (SELECT id FROM _seed_dists);

DELETE FROM alwayson_distribuidores
WHERE id IN (SELECT id FROM _seed_dists);

-- SKUs de demo do seed 003 (se ainda existirem); catálogo Pergola permanece
DELETE FROM alwayson_produtos WHERE sku LIKE 'AO-%';
