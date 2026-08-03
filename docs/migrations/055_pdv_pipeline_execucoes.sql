-- Migration 055 — Log de execuções do pipeline PDV (Railway).
--
-- Escrita via service_role; leitura admin para auditoria operacional.
-- Projeto canônico: osukbalwykbqvoumddxz

CREATE TABLE IF NOT EXISTS alwayson_pdv_pipeline_execucoes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  etapa        text NOT NULL,
  parametros   jsonb NOT NULL DEFAULT '{}',
  status       text NOT NULL DEFAULT 'pendente'
                 CHECK (status IN ('pendente', 'processando', 'concluido', 'erro')),
  resultado    jsonb,
  erro         jsonb,
  iniciado_em  timestamptz NOT NULL DEFAULT now(),
  concluido_em timestamptz
);

COMMENT ON TABLE alwayson_pdv_pipeline_execucoes IS
  'Auditoria de jobs do pipeline PDV (Receita, score, CNEFE, cruzamento). Populado pelo serviço Railway com service_role.';

CREATE INDEX IF NOT EXISTS idx_pdv_pipeline_exec_etapa
  ON alwayson_pdv_pipeline_execucoes (etapa, iniciado_em DESC);

CREATE INDEX IF NOT EXISTS idx_pdv_pipeline_exec_status
  ON alwayson_pdv_pipeline_execucoes (status, iniciado_em DESC);

ALTER TABLE alwayson_pdv_pipeline_execucoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS alwayson_pdv_pipeline_execucoes_select_admin ON alwayson_pdv_pipeline_execucoes;
CREATE POLICY alwayson_pdv_pipeline_execucoes_select_admin
  ON alwayson_pdv_pipeline_execucoes FOR SELECT TO authenticated
  USING (public.current_user_is_admin());

GRANT SELECT ON alwayson_pdv_pipeline_execucoes TO authenticated;
