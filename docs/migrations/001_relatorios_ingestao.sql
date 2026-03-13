-- Migration: Tabela de controle de ingestão de relatórios
-- Execute no Supabase SQL Editor antes de usar o módulo de ingestão

CREATE TABLE IF NOT EXISTS alwayson_relatorios_ingestao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  distribuidor_id UUID NOT NULL REFERENCES alwayson_distribuidores(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('vendas','estoque','clientes')),
  arquivo_nome TEXT NOT NULL,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente','processando','concluido','erro')),
  periodo_referencia DATE NOT NULL,
  registros_processados INTEGER,
  erros JSONB,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_relatorios_ingestao_distribuidor
  ON alwayson_relatorios_ingestao(distribuidor_id);

CREATE INDEX IF NOT EXISTS idx_relatorios_ingestao_criado
  ON alwayson_relatorios_ingestao(criado_em DESC);

CREATE INDEX IF NOT EXISTS idx_relatorios_ingestao_status
  ON alwayson_relatorios_ingestao(status);

-- RLS: Se usar RLS no projeto, crie políticas para allow select/insert/update
-- conforme sua autenticação. Sem políticas, a tabela fica acessível via service_role.
