-- RAIS × universo PDV Petrolina via Base dos Dados (BigQuery).
--
-- Pré-requisitos:
--   1. Conta Google Cloud + billing (consulta pequena ≈ centavos)
--   2. `pip install basedosdados` ou usar console BigQuery
--   3. `basedosdados.auth()` ou ADC configurado
--
-- Uso (Python one-shot):
--   basedosdados.read_sql_query(open('scripts/rais-bq-petrolina.sql').read(), billing_project_id='SEU_GCP')
--
-- Exporte o resultado para data/rais/2023/petrolina_vinculos_bq.csv e cruze localmente por CNPJ.

SELECT
  e.cnpj,
  e.quantidade_vinculos_ativos,
  e.quantidade_vinculos_clt,
  e.cnae_2_subclasse,
  e.tamanho_estabelecimento,
  e.indicador_simples,
  e.sigla_uf,
  e.id_municipio
FROM `basedosdados.br_me_rais.microdados_estabelecimentos` AS e
WHERE e.ano = 2023
  AND e.id_municipio = '2611101'
  AND e.cnpj IN (
    -- Substitua pela lista de CNPJs do piloto (14 dígitos, sem pontuação).
    -- Ex.: exportar do Supabase:
    --   SELECT cnpj FROM alwayson_pdv_universo WHERE codigo_ibge = 2611101
    '00000000000000'
  )
ORDER BY e.quantidade_vinculos_ativos DESC;
