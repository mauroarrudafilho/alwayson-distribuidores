import type {
  InsightsCidadeRow,
  InsightsTopCliente,
  InsightsClienteMes,
  InsightsClienteMixRow,
} from '@/types/insights'

// ─── Visão por cidade ────────────────────────────────────────────────────────

export const MOCK_CIDADES: InsightsCidadeRow[] = [
  { cidade: 'João Pessoa',     estado: 'PB', faturamento_total: 1_842_300, total_nfs: 312, total_clientes: 48, ticket_medio_cliente: 38_381, total_skus: 18, quantidade_total: 42_800, unidade_predominante: 'UN' },
  { cidade: 'Campina Grande',  estado: 'PB', faturamento_total: 1_214_500, total_nfs: 198, total_clientes: 31, ticket_medio_cliente: 39_177, total_skus: 16, quantidade_total: 28_100, unidade_predominante: 'UN' },
  { cidade: 'Recife',          estado: 'PE', faturamento_total:   987_200, total_nfs: 165, total_clientes: 27, ticket_medio_cliente: 36_563, total_skus: 15, quantidade_total: 22_400, unidade_predominante: 'CX' },
  { cidade: 'Caruaru',         estado: 'PE', faturamento_total:   712_400, total_nfs: 120, total_clientes: 19, ticket_medio_cliente: 37_495, total_skus: 13, quantidade_total: 16_200, unidade_predominante: 'UN' },
  { cidade: 'Natal',           estado: 'RN', faturamento_total:   634_100, total_nfs:  98, total_clientes: 16, ticket_medio_cliente: 39_631, total_skus: 14, quantidade_total: 14_800, unidade_predominante: 'UN' },
  { cidade: 'Mossoró',         estado: 'RN', faturamento_total:   489_700, total_nfs:  82, total_clientes: 14, ticket_medio_cliente: 34_979, total_skus: 12, quantidade_total: 11_200, unidade_predominante: 'UN' },
  { cidade: 'Maceió',          estado: 'AL', faturamento_total:   421_800, total_nfs:  71, total_clientes: 11, ticket_medio_cliente: 38_345, total_skus: 11, quantidade_total:  9_600, unidade_predominante: 'UN' },
  { cidade: 'Aracaju',         estado: 'SE', faturamento_total:   318_500, total_nfs:  54, total_clientes:  9, ticket_medio_cliente: 35_389, total_skus: 10, quantidade_total:  7_300, unidade_predominante: 'CX' },
]

// ─── Top clientes de uma cidade ──────────────────────────────────────────────

export const MOCK_TOP_CLIENTES: Record<string, InsightsTopCliente[]> = {
  'João Pessoa': [
    { cnpj_cliente: '07891234000155', nome_cliente: 'Supermercado Bom Preço LTDA',       cidade: 'João Pessoa', estado: 'PB', faturamento_total: 284_200, total_nfs: 48, ultima_compra: '2026-03-12', total_skus: 15 },
    { cnpj_cliente: '12345678000190', nome_cliente: 'Atacadão do Nordeste SA',            cidade: 'João Pessoa', estado: 'PB', faturamento_total: 221_400, total_nfs: 36, ultima_compra: '2026-03-10', total_skus: 13 },
    { cnpj_cliente: '98765432000144', nome_cliente: 'Mercado Familiar JP',                cidade: 'João Pessoa', estado: 'PB', faturamento_total: 178_900, total_nfs: 29, ultima_compra: '2026-03-08', total_skus: 12 },
    { cnpj_cliente: '45678901000122', nome_cliente: 'Distribuidora Centro Sul',           cidade: 'João Pessoa', estado: 'PB', faturamento_total: 152_300, total_nfs: 24, ultima_compra: '2026-03-11', total_skus: 11 },
    { cnpj_cliente: '32109876000188', nome_cliente: 'Loja das Marcas EIRELI',             cidade: 'João Pessoa', estado: 'PB', faturamento_total: 131_800, total_nfs: 22, ultima_compra: '2026-03-05', total_skus:  9 },
  ],
  'Campina Grande': [
    { cnpj_cliente: '56789012000177', nome_cliente: 'Supermix Atacado CG',               cidade: 'Campina Grande', estado: 'PB', faturamento_total: 198_700, total_nfs: 33, ultima_compra: '2026-03-11', total_skus: 13 },
    { cnpj_cliente: '65432109000166', nome_cliente: 'Mercado Econômico LTDA',            cidade: 'Campina Grande', estado: 'PB', faturamento_total: 165_400, total_nfs: 27, ultima_compra: '2026-03-09', total_skus: 11 },
    { cnpj_cliente: '11223344000155', nome_cliente: 'Armazém do Povo CG',                cidade: 'Campina Grande', estado: 'PB', faturamento_total: 132_100, total_nfs: 22, ultima_compra: '2026-03-07', total_skus: 10 },
  ],
}

// ─── Evolução histórica mensal de um cliente ─────────────────────────────────

export const MOCK_CLIENTE_HISTORICO: Record<string, InsightsClienteMes[]> = {
  '07891234000155': [
    { ano_mes: '2025-10', faturamento:  42_100, total_nfs: 6, total_skus:  9, quantidade_total: 940 },
    { ano_mes: '2025-11', faturamento:  51_800, total_nfs: 7, total_skus: 11, quantidade_total: 1_180 },
    { ano_mes: '2025-12', faturamento:  48_300, total_nfs: 7, total_skus: 10, quantidade_total: 1_080 },
    { ano_mes: '2026-01', faturamento:  55_700, total_nfs: 8, total_skus: 12, quantidade_total: 1_260 },
    { ano_mes: '2026-02', faturamento:  44_900, total_nfs: 7, total_skus: 10, quantidade_total: 1_010 },
    { ano_mes: '2026-03', faturamento:  41_400, total_nfs: 6, total_skus:  9, quantidade_total:  920 },
  ],
  '12345678000190': [
    { ano_mes: '2025-10', faturamento:  28_500, total_nfs: 4, total_skus:  8, quantidade_total: 640 },
    { ano_mes: '2025-11', faturamento:  34_200, total_nfs: 5, total_skus:  9, quantidade_total: 780 },
    { ano_mes: '2025-12', faturamento:  41_800, total_nfs: 6, total_skus: 11, quantidade_total: 940 },
    { ano_mes: '2026-01', faturamento:  38_900, total_nfs: 6, total_skus: 10, quantidade_total: 880 },
    { ano_mes: '2026-02', faturamento:  45_100, total_nfs: 7, total_skus: 11, quantidade_total: 1_020 },
    { ano_mes: '2026-03', faturamento:  32_900, total_nfs: 5, total_skus:  8, quantidade_total: 740 },
  ],
}

// ─── Mix de SKUs de um cliente ───────────────────────────────────────────────

export const MOCK_CLIENTE_MIX: Record<string, InsightsClienteMixRow[]> = {
  '07891234000155': [
    { sku: 'CAMP-001', descricao: 'Manteiga Campestre 200g',     meses_ativos: 6, quantidade_total: 2_840, unidade: 'UN', faturamento_total: 81_100, primeira_compra: '2025-10-05', ultima_compra: '2026-03-12' },
    { sku: 'CAMP-003', descricao: 'Requeijão Campestre 200g',    meses_ativos: 6, quantidade_total: 2_110, unidade: 'UN', faturamento_total: 63_300, primeira_compra: '2025-10-05', ultima_compra: '2026-03-12' },
    { sku: 'CAMP-007', descricao: 'Cream Cheese Campestre 150g', meses_ativos: 5, quantidade_total: 1_420, unidade: 'UN', faturamento_total: 48_280, primeira_compra: '2025-11-03', ultima_compra: '2026-03-12' },
    { sku: 'CAMP-012', descricao: 'Manteiga Sem Sal 500g',       meses_ativos: 4, quantidade_total:   980, unidade: 'UN', faturamento_total: 36_260, primeira_compra: '2025-12-01', ultima_compra: '2026-03-12' },
    { sku: 'CAMP-015', descricao: 'Ricota Cremosa 250g',         meses_ativos: 3, quantidade_total:   640, unidade: 'UN', faturamento_total: 22_400, primeira_compra: '2026-01-08', ultima_compra: '2026-03-12' },
    { sku: 'CAMP-021', descricao: 'Iogurte Natural 1kg',         meses_ativos: 2, quantidade_total:   380, unidade: 'UN', faturamento_total: 15_580, primeira_compra: '2026-02-10', ultima_compra: '2026-03-12' },
  ],
  '12345678000190': [
    { sku: 'CAMP-001', descricao: 'Manteiga Campestre 200g',     meses_ativos: 6, quantidade_total: 2_100, unidade: 'UN', faturamento_total: 60_900, primeira_compra: '2025-10-08', ultima_compra: '2026-03-10' },
    { sku: 'CAMP-003', descricao: 'Requeijão Campestre 200g',    meses_ativos: 5, quantidade_total: 1_640, unidade: 'UN', faturamento_total: 49_200, primeira_compra: '2025-11-12', ultima_compra: '2026-03-10' },
    { sku: 'CAMP-007', descricao: 'Cream Cheese Campestre 150g', meses_ativos: 4, quantidade_total:   920, unidade: 'UN', faturamento_total: 31_280, primeira_compra: '2025-12-05', ultima_compra: '2026-03-10' },
    { sku: 'CAMP-012', descricao: 'Manteiga Sem Sal 500g',       meses_ativos: 3, quantidade_total:   740, unidade: 'UN', faturamento_total: 27_380, primeira_compra: '2026-01-15', ultima_compra: '2026-03-10' },
  ],
}

export const MOCK_PERIODO = { inicio: 'Out/2025', fim: 'Mar/2026' }

export const MOCK_KPI_GERAL = {
  faturamento_total:    6_620_500,
  total_cidades:                8,
  total_clientes:             175,
  total_nfs:                1_100,
  total_skus:                  22,
}

/** Todos os clientes com mock (flat + rank por faturamento). */
export const MOCK_TODOS_CLIENTES: InsightsTopCliente[] = (() => {
  const list = Object.values(MOCK_TOP_CLIENTES).flat()
  const byCnpj = new Map<string, InsightsTopCliente>()
  for (const c of list) {
    const prev = byCnpj.get(c.cnpj_cliente)
    if (!prev || prev.faturamento_total < c.faturamento_total) {
      byCnpj.set(c.cnpj_cliente, c)
    }
  }
  return [...byCnpj.values()].sort((a, b) => b.faturamento_total - a.faturamento_total)
})()
