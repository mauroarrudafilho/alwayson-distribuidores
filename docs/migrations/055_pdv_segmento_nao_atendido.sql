-- Segmento para PDVs qualificados fora da carteira (priorização de conquista).

ALTER TYPE alwayson_pdv_segmento ADD VALUE IF NOT EXISTS 'nao_atendido';

COMMENT ON TABLE alwayson_pdv_prioridade IS
  'Ranking de priorização: oportunidades não atendidas (índice de consolidação) e segmentos da carteira cruzados com sell-in. Escopo distribuidor × fornecedor.';
