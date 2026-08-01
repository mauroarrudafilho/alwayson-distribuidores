-- Migration 050 — rede de proteção: carimbo do fornecedor no banco.
--
-- A migration 047 passou a exigir `fornecedor_id` na API de ingestão, mas a API
-- é um serviço à parte (`services/ingest-api`, Dockerfile próprio) e pode estar
-- rodando uma versão anterior. Nesse caso a nota entraria com
-- `fornecedor_tenant_id` NULL e — como `NULL IN (...)` é NULL sob as policies da
-- 048 — ficaria invisível para KAM e distribuidor. Não vaza, mas some.
--
-- Em vez de depender de qual versão da API está no ar, o banco resolve: quando
-- o distribuidor tem exatamente um fornecedor ativo, o carimbo é inferido. Com
-- dois ou mais mantém NULL de propósito — aí a origem *precisa* informar, e o
-- sumiço da linha é o sinal de que a API está desatualizada.
--
-- Generaliza a função específica de metas criada na 049, que fazia exatamente
-- isto para uma tabela só.
--
-- Projeto canônico: osukbalwykbqvoumddxz

CREATE OR REPLACE FUNCTION public.fn_alwayson_default_fornecedor_por_distribuidor()
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

COMMENT ON FUNCTION public.fn_alwayson_default_fornecedor_por_distribuidor() IS
  'Infere o fornecedor quando o distribuidor tem só um ativo. Protege contra origem que não carimba (API de ingestão desatualizada). Com vários fornecedores mantém NULL — a origem tem de escolher.';

-- Aplica às tabelas que a ingestão escreve.
DROP TRIGGER IF EXISTS trg_faturamento_default_fornecedor ON alwayson_faturamento;
CREATE TRIGGER trg_faturamento_default_fornecedor
BEFORE INSERT ON alwayson_faturamento
FOR EACH ROW EXECUTE FUNCTION public.fn_alwayson_default_fornecedor_por_distribuidor();

DROP TRIGGER IF EXISTS trg_relatorios_default_fornecedor ON alwayson_relatorios_ingestao;
CREATE TRIGGER trg_relatorios_default_fornecedor
BEFORE INSERT ON alwayson_relatorios_ingestao
FOR EACH ROW EXECUTE FUNCTION public.fn_alwayson_default_fornecedor_por_distribuidor();

DROP TRIGGER IF EXISTS trg_estoque_default_fornecedor ON alwayson_estoque_distribuidor;
CREATE TRIGGER trg_estoque_default_fornecedor
BEFORE INSERT ON alwayson_estoque_distribuidor
FOR EACH ROW EXECUTE FUNCTION public.fn_alwayson_default_fornecedor_por_distribuidor();

-- Metas passam a usar a função genérica; a específica da 049 sai de cena.
DROP TRIGGER IF EXISTS trg_alwayson_metas_default_fornecedor ON alwayson_metas_distribuidor;
CREATE TRIGGER trg_metas_default_fornecedor
BEFORE INSERT ON alwayson_metas_distribuidor
FOR EACH ROW EXECUTE FUNCTION public.fn_alwayson_default_fornecedor_por_distribuidor();

DROP FUNCTION IF EXISTS public.fn_alwayson_metas_default_fornecedor();
