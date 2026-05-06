-- Migration 002: Criar tabelas novas e atualizar existentes
-- Referência: docs/superpowers/specs/2026-03-14-reestruturacao-plataforma-design.md

-- 1. Novas colunas em tabelas existentes
ALTER TABLE alwayson_distribuidores
  ADD COLUMN IF NOT EXISTS lead_time_dias integer DEFAULT 7;

ALTER TABLE alwayson_estoque_distribuidor
  ADD COLUMN IF NOT EXISTS estoque_minimo_calculado numeric;

-- 2. Tabela de produtos
CREATE TABLE IF NOT EXISTS alwayson_produtos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text NOT NULL UNIQUE,
  descricao text NOT NULL,
  categoria text,
  preco_referencia numeric,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now()
);

-- 3. Tabela de faturamento
CREATE TABLE IF NOT EXISTS alwayson_faturamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  distribuidor_id uuid NOT NULL REFERENCES alwayson_distribuidores(id),
  cliente_id uuid NOT NULL REFERENCES alwayson_clientes_distribuidor(id),
  vendedor_id uuid NOT NULL REFERENCES alwayson_vendedores_distribuidor(id),
  numero_nf text NOT NULL,
  data_emissao date NOT NULL,
  valor_total numeric NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE(distribuidor_id, numero_nf)
);

CREATE INDEX IF NOT EXISTS idx_faturamento_cliente ON alwayson_faturamento(cliente_id);
CREATE INDEX IF NOT EXISTS idx_faturamento_vendedor ON alwayson_faturamento(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_faturamento_data ON alwayson_faturamento(data_emissao);

-- 4. Tabela de itens de faturamento
CREATE TABLE IF NOT EXISTS alwayson_faturamento_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  faturamento_id uuid NOT NULL REFERENCES alwayson_faturamento(id) ON DELETE CASCADE,
  produto_id uuid REFERENCES alwayson_produtos(id),
  sku text NOT NULL,
  descricao text NOT NULL,
  quantidade numeric NOT NULL,
  valor_unitario numeric NOT NULL,
  valor_total numeric NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_faturamento_itens_fat ON alwayson_faturamento_itens(faturamento_id);

-- 5. Tabela de configuração de excelência
CREATE TABLE IF NOT EXISTS alwayson_excelencia_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  distribuidor_id uuid NOT NULL REFERENCES alwayson_distribuidores(id),
  criterio_nome text NOT NULL,
  meta_valor numeric NOT NULL,
  tipo_comparacao text NOT NULL CHECK (tipo_comparacao IN ('min', 'max')),
  ativo boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);

-- 6. Tabela de clientes do plano de excelência
CREATE TABLE IF NOT EXISTS alwayson_excelencia_clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  distribuidor_id uuid NOT NULL REFERENCES alwayson_distribuidores(id),
  cliente_id uuid NOT NULL REFERENCES alwayson_clientes_distribuidor(id),
  ativo boolean NOT NULL DEFAULT true,
  adicionado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE(distribuidor_id, cliente_id)
);
