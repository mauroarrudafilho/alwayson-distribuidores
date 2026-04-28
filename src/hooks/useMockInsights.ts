import type {
  InsightsCidadeRow,
  InsightsTopCliente,
  InsightsClienteMes,
  InsightsClienteMixRow,
  InsightsProdutoRow,
  InsightsProdutoDetalhe,
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

/**
 * Matches com CNPJs do seed real (003_seed_dados_mock.sql) para que a ponte
 * Performance → Insights funcione na demo. Em produção esses dados viriam
 * do upload XLSX do distribuidor.
 */
const MOCK_INSIGHTS_MATCHES_REAIS: InsightsTopCliente[] = [
  { cnpj_cliente: '22.222.111/0001-01', nome_cliente: 'Mercado Central JP Ltda',     cidade: 'João Pessoa',    estado: 'PB', faturamento_total: 184_300, total_nfs: 31, ultima_compra: '2026-03-11', total_skus: 14 },
  { cnpj_cliente: '22.222.333/0001-03', nome_cliente: 'Atacadão Paraíba',            cidade: 'Campina Grande', estado: 'PB', faturamento_total: 312_700, total_nfs: 52, ultima_compra: '2026-03-13', total_skus: 16 },
  { cnpj_cliente: '11.111.222/0001-02', nome_cliente: 'Supermercado Bom Preço S.A.', cidade: 'Recife',         estado: 'PE', faturamento_total: 226_800, total_nfs: 38, ultima_compra: '2026-03-12', total_skus: 13 },
  { cnpj_cliente: '33.333.111/0001-01', nome_cliente: 'Hipermercado Ponta Negra',     cidade: 'Natal',          estado: 'RN', faturamento_total: 271_400, total_nfs: 45, ultima_compra: '2026-03-12', total_skus: 15 },
  { cnpj_cliente: '11.111.999/0001-09', nome_cliente: 'Hotel Atlântico Palace',       cidade: 'Recife',         estado: 'PE', faturamento_total: 158_600, total_nfs: 26, ultima_compra: '2026-03-13', total_skus: 11 },
]

/** Histórico mensal para os matches reais (popover comparativo). */
MOCK_CLIENTE_HISTORICO['22.222.111/0001-01'] = [
  { ano_mes: '2025-10', faturamento: 26_400, total_nfs: 4, total_skus: 10, quantidade_total: 580 },
  { ano_mes: '2025-11', faturamento: 31_200, total_nfs: 5, total_skus: 11, quantidade_total: 720 },
  { ano_mes: '2025-12', faturamento: 28_900, total_nfs: 5, total_skus: 11, quantidade_total: 660 },
  { ano_mes: '2026-01', faturamento: 33_500, total_nfs: 6, total_skus: 12, quantidade_total: 760 },
  { ano_mes: '2026-02', faturamento: 32_700, total_nfs: 5, total_skus: 11, quantidade_total: 740 },
  { ano_mes: '2026-03', faturamento: 31_600, total_nfs: 6, total_skus: 12, quantidade_total: 720 },
]

MOCK_CLIENTE_HISTORICO['22.222.333/0001-03'] = [
  { ano_mes: '2025-10', faturamento: 48_200, total_nfs: 8, total_skus: 13, quantidade_total: 1_120 },
  { ano_mes: '2025-11', faturamento: 52_400, total_nfs: 9, total_skus: 14, quantidade_total: 1_220 },
  { ano_mes: '2025-12', faturamento: 49_800, total_nfs: 8, total_skus: 14, quantidade_total: 1_160 },
  { ano_mes: '2026-01', faturamento: 56_100, total_nfs: 9, total_skus: 15, quantidade_total: 1_300 },
  { ano_mes: '2026-02', faturamento: 53_700, total_nfs: 9, total_skus: 15, quantidade_total: 1_240 },
  { ano_mes: '2026-03', faturamento: 52_500, total_nfs: 9, total_skus: 16, quantidade_total: 1_220 },
]

MOCK_CLIENTE_HISTORICO['11.111.222/0001-02'] = [
  { ano_mes: '2025-10', faturamento: 32_400, total_nfs: 5, total_skus: 10, quantidade_total: 740 },
  { ano_mes: '2025-11', faturamento: 38_100, total_nfs: 6, total_skus: 11, quantidade_total: 880 },
  { ano_mes: '2025-12', faturamento: 36_500, total_nfs: 6, total_skus: 12, quantidade_total: 840 },
  { ano_mes: '2026-01', faturamento: 41_200, total_nfs: 7, total_skus: 13, quantidade_total: 940 },
  { ano_mes: '2026-02', faturamento: 39_800, total_nfs: 7, total_skus: 12, quantidade_total: 920 },
  { ano_mes: '2026-03', faturamento: 38_800, total_nfs: 7, total_skus: 13, quantidade_total: 900 },
]

MOCK_CLIENTE_HISTORICO['33.333.111/0001-01'] = [
  { ano_mes: '2025-10', faturamento: 38_900, total_nfs: 6, total_skus: 12, quantidade_total: 880 },
  { ano_mes: '2025-11', faturamento: 45_200, total_nfs: 8, total_skus: 13, quantidade_total: 1_040 },
  { ano_mes: '2025-12', faturamento: 43_800, total_nfs: 7, total_skus: 13, quantidade_total: 1_000 },
  { ano_mes: '2026-01', faturamento: 49_500, total_nfs: 8, total_skus: 14, quantidade_total: 1_140 },
  { ano_mes: '2026-02', faturamento: 47_300, total_nfs: 8, total_skus: 14, quantidade_total: 1_080 },
  { ano_mes: '2026-03', faturamento: 46_700, total_nfs: 8, total_skus: 15, quantidade_total: 1_080 },
]

/** Todos os clientes com mock (flat + rank por faturamento). */
export const MOCK_TODOS_CLIENTES: InsightsTopCliente[] = (() => {
  const list = [...Object.values(MOCK_TOP_CLIENTES).flat(), ...MOCK_INSIGHTS_MATCHES_REAIS]
  const byCnpj = new Map<string, InsightsTopCliente>()
  for (const c of list) {
    const prev = byCnpj.get(c.cnpj_cliente)
    if (!prev || prev.faturamento_total < c.faturamento_total) {
      byCnpj.set(c.cnpj_cliente, c)
    }
  }
  return [...byCnpj.values()].sort((a, b) => b.faturamento_total - a.faturamento_total)
})()

// ─── Visão por produto (aba Produtos) ────────────────────────────────────────

export const MOCK_PRODUTOS: InsightsProdutoRow[] = [
  { sku: 'CAMP-001', descricao: 'Manteiga Campestre 200g',     categoria: 'Manteigas',  faturamento_total: 1_842_300, quantidade_total: 64_200, unidade: 'UN', total_nfs: 312, total_clientes: 142, total_cidades: 8, primeira_venda: '2025-10-03', ultima_venda: '2026-03-12' },
  { sku: 'CAMP-003', descricao: 'Requeijão Campestre 200g',    categoria: 'Cremosos',   faturamento_total: 1_214_500, quantidade_total: 48_100, unidade: 'UN', total_nfs: 264, total_clientes: 121, total_cidades: 8, primeira_venda: '2025-10-05', ultima_venda: '2026-03-12' },
  { sku: 'CAMP-007', descricao: 'Cream Cheese Campestre 150g', categoria: 'Cremosos',   faturamento_total:   987_200, quantidade_total: 31_400, unidade: 'UN', total_nfs: 198, total_clientes:  98, total_cidades: 7, primeira_venda: '2025-11-03', ultima_venda: '2026-03-12' },
  { sku: 'CAMP-012', descricao: 'Manteiga Sem Sal 500g',       categoria: 'Manteigas',  faturamento_total:   712_400, quantidade_total: 18_900, unidade: 'UN', total_nfs: 152, total_clientes:  76, total_cidades: 6, primeira_venda: '2025-12-01', ultima_venda: '2026-03-12' },
  { sku: 'CAMP-015', descricao: 'Ricota Cremosa 250g',         categoria: 'Queijos',    faturamento_total:   634_100, quantidade_total: 16_400, unidade: 'UN', total_nfs: 128, total_clientes:  64, total_cidades: 6, primeira_venda: '2026-01-08', ultima_venda: '2026-03-11' },
  { sku: 'CAMP-005', descricao: 'Queijo Coalho 400g',          categoria: 'Queijos',    faturamento_total:   489_700, quantidade_total: 12_100, unidade: 'UN', total_nfs:  98, total_clientes:  52, total_cidades: 5, primeira_venda: '2025-10-12', ultima_venda: '2026-03-10' },
  { sku: 'CAMP-021', descricao: 'Iogurte Natural 1kg',         categoria: 'Iogurtes',   faturamento_total:   421_800, quantidade_total: 14_800, unidade: 'UN', total_nfs:  87, total_clientes:  48, total_cidades: 5, primeira_venda: '2026-02-10', ultima_venda: '2026-03-12' },
  { sku: 'CAMP-009', descricao: 'Mussarela Fatiada 150g',      categoria: 'Queijos',    faturamento_total:   318_500, quantidade_total:  9_400, unidade: 'UN', total_nfs:  72, total_clientes:  41, total_cidades: 4, primeira_venda: '2025-11-15', ultima_venda: '2026-03-09' },
  { sku: 'CAMP-018', descricao: 'Iogurte Morango 1kg',         categoria: 'Iogurtes',   faturamento_total:   267_400, quantidade_total:  8_200, unidade: 'UN', total_nfs:  64, total_clientes:  36, total_cidades: 4, primeira_venda: '2026-01-22', ultima_venda: '2026-03-10' },
  { sku: 'CAMP-024', descricao: 'Doce de Leite 400g',          categoria: 'Doces',      faturamento_total:   184_300, quantidade_total:  5_600, unidade: 'UN', total_nfs:  48, total_clientes:  28, total_cidades: 3, primeira_venda: '2025-12-08', ultima_venda: '2026-03-08' },
  { sku: 'CAMP-031', descricao: 'Leite Condensado 395g',       categoria: 'Doces',      faturamento_total:   142_800, quantidade_total:  4_800, unidade: 'UN', total_nfs:  39, total_clientes:  22, total_cidades: 3, primeira_venda: '2026-01-15', ultima_venda: '2026-03-07' },
  { sku: 'CAMP-042', descricao: 'Queijo Minas Frescal 500g',   categoria: 'Queijos',    faturamento_total:    98_400, quantidade_total:  2_900, unidade: 'UN', total_nfs:  28, total_clientes:  17, total_cidades: 2, primeira_venda: '2026-02-01', ultima_venda: '2026-03-05' },
]

/** Drill-down de cada SKU — top clientes e top cidades. */
export const MOCK_PRODUTO_DETALHE: Record<string, InsightsProdutoDetalhe> = {
  'CAMP-001': {
    topClientes: [
      { cnpj_cliente: '07891234000155', nome_cliente: 'Supermercado Bom Preço LTDA',  cidade: 'João Pessoa',    estado: 'PB', quantidade_total: 2_840, faturamento_total: 81_100 },
      { cnpj_cliente: '12345678000190', nome_cliente: 'Atacadão do Nordeste SA',       cidade: 'João Pessoa',    estado: 'PB', quantidade_total: 2_100, faturamento_total: 60_900 },
      { cnpj_cliente: '56789012000177', nome_cliente: 'Supermix Atacado CG',           cidade: 'Campina Grande', estado: 'PB', quantidade_total: 1_980, faturamento_total: 57_400 },
      { cnpj_cliente: '98765432000144', nome_cliente: 'Mercado Familiar JP',           cidade: 'João Pessoa',    estado: 'PB', quantidade_total: 1_640, faturamento_total: 47_500 },
    ],
    topCidades: [
      { cidade: 'João Pessoa',    estado: 'PB', quantidade_total: 18_400, faturamento_total: 533_200, total_clientes: 42 },
      { cidade: 'Campina Grande', estado: 'PB', quantidade_total: 12_100, faturamento_total: 350_900, total_clientes: 28 },
      { cidade: 'Recife',         estado: 'PE', quantidade_total:  9_800, faturamento_total: 284_200, total_clientes: 22 },
      { cidade: 'Caruaru',        estado: 'PE', quantidade_total:  7_300, faturamento_total: 211_700, total_clientes: 18 },
      { cidade: 'Natal',          estado: 'RN', quantidade_total:  6_400, faturamento_total: 185_600, total_clientes: 15 },
    ],
  },
  'CAMP-003': {
    topClientes: [
      { cnpj_cliente: '07891234000155', nome_cliente: 'Supermercado Bom Preço LTDA',  cidade: 'João Pessoa',    estado: 'PB', quantidade_total: 2_110, faturamento_total: 63_300 },
      { cnpj_cliente: '12345678000190', nome_cliente: 'Atacadão do Nordeste SA',       cidade: 'João Pessoa',    estado: 'PB', quantidade_total: 1_640, faturamento_total: 49_200 },
      { cnpj_cliente: '65432109000166', nome_cliente: 'Mercado Econômico LTDA',        cidade: 'Campina Grande', estado: 'PB', quantidade_total: 1_420, faturamento_total: 42_600 },
    ],
    topCidades: [
      { cidade: 'João Pessoa',    estado: 'PB', quantidade_total: 14_200, faturamento_total: 426_000, total_clientes: 38 },
      { cidade: 'Campina Grande', estado: 'PB', quantidade_total:  9_800, faturamento_total: 294_000, total_clientes: 26 },
      { cidade: 'Recife',         estado: 'PE', quantidade_total:  7_400, faturamento_total: 222_000, total_clientes: 20 },
    ],
  },
}
