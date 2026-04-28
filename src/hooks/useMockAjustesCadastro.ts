import { useSyncExternalStore } from 'react'

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type AjusteTipo =
  | 'cnpj'
  | 'razao_social'
  | 'nome_fantasia'
  | 'endereco'
  | 'vendedor'
  | 'outro'

export type AjusteMotivo =
  | 'mudanca_societaria'
  | 'matriz_filial'
  | 'erro_cadastro'
  | 'atualizacao'
  | 'rebranding'
  | 'desligamento'
  | 'outro'

export const TIPO_LABELS: Record<AjusteTipo, string> = {
  cnpj:           'CNPJ',
  razao_social:   'Razão social',
  nome_fantasia:  'Nome fantasia',
  endereco:       'Endereço',
  vendedor:       'Vendedor responsável',
  outro:          'Outro',
}

export const MOTIVO_LABELS: Record<AjusteMotivo, string> = {
  mudanca_societaria: 'Mudança societária',
  matriz_filial:      'Matriz ↔ Filial',
  erro_cadastro:      'Erro de cadastro',
  atualizacao:        'Atualização',
  rebranding:         'Rebranding',
  desligamento:       'Desligamento de vendedor',
  outro:              'Outro',
}

/** Motivos válidos para cada tipo de ajuste. */
export const MOTIVOS_POR_TIPO: Record<AjusteTipo, AjusteMotivo[]> = {
  cnpj:          ['mudanca_societaria', 'matriz_filial', 'erro_cadastro', 'outro'],
  razao_social:  ['mudanca_societaria', 'atualizacao', 'erro_cadastro', 'outro'],
  nome_fantasia: ['rebranding', 'atualizacao', 'erro_cadastro', 'outro'],
  endereco:      ['atualizacao', 'erro_cadastro', 'outro'],
  vendedor:      ['atualizacao', 'desligamento', 'erro_cadastro', 'outro'],
  outro:         ['outro'],
}

export interface AjusteCadastro {
  id: string
  cliente_id: string
  cliente_nome: string
  tipo: AjusteTipo
  /** Valor anterior (CNPJ antigo, nome antigo, endereço antigo, etc.). */
  valor_anterior: string
  /** Valor atual no momento do registro (snapshot do cadastro). */
  valor_atual: string
  motivo: AjusteMotivo
  observacao?: string
  criado_por: string
  criado_em: string
  reverted_em?: string
  reverted_por?: string
}

// ─── Estado mock (in-memory) ─────────────────────────────────────────────────

/**
 * Seeds usam cliente_ids do seed real (003_seed_dados_mock.sql) para que a
 * navegação "linha → detalhe do cliente" no Admin funcione na demo.
 */
const SEED_AJUSTES: AjusteCadastro[] = [
  {
    id: 'aj-001',
    cliente_id: 'c1000000-0000-0000-0000-000000000002',
    cliente_nome: 'Supermercado Bom Preço S.A.',
    tipo: 'cnpj',
    valor_anterior: '11.111.222/0001-99',
    valor_atual:    '11.111.222/0001-02',
    motivo: 'mudanca_societaria',
    observacao: 'Reestruturação societária após aquisição em 2024.',
    criado_por: 'maurofilho@grupoarruda.com',
    criado_em: '2025-11-08T14:32:00.000Z',
  },
  {
    id: 'aj-002',
    cliente_id: 'c2000000-0000-0000-0000-000000000003',
    cliente_nome: 'Atacadão Paraíba',
    tipo: 'cnpj',
    valor_anterior: '22.222.333/0002-71',
    valor_atual:    '22.222.333/0001-03',
    motivo: 'matriz_filial',
    observacao: 'Filial JP migrou faturamento para a matriz CG.',
    criado_por: 'maurofilho@grupoarruda.com',
    criado_em: '2026-01-22T09:18:00.000Z',
  },
  {
    id: 'aj-003',
    cliente_id: 'c2000000-0000-0000-0000-000000000001',
    cliente_nome: 'Mercado Central JP Ltda',
    tipo: 'cnpj',
    valor_anterior: '22.222.111/0099-01',
    valor_atual:    '22.222.111/0001-01',
    motivo: 'erro_cadastro',
    criado_por: 'maurofilho@grupoarruda.com',
    criado_em: '2026-02-14T16:05:00.000Z',
    reverted_em: '2026-02-15T10:42:00.000Z',
    reverted_por: 'maurofilho@grupoarruda.com',
  },
  {
    id: 'aj-004',
    cliente_id: 'c1000000-0000-0000-0000-000000000002',
    cliente_nome: 'Supermercado Bom Preço S.A.',
    tipo: 'nome_fantasia',
    valor_anterior: 'Bom Preço Supermercados',
    valor_atual:    'Bom Preço',
    motivo: 'rebranding',
    observacao: 'Nova identidade visual em 2025.',
    criado_por: 'maurofilho@grupoarruda.com',
    criado_em: '2025-12-03T11:20:00.000Z',
  },
  {
    id: 'aj-005',
    cliente_id: 'c3000000-0000-0000-0000-000000000001',
    cliente_nome: 'Hipermercado Ponta Negra',
    tipo: 'endereco',
    valor_anterior: 'Av. Hermes da Fonseca, 1500 — Tirol, Natal/RN',
    valor_atual:    'Av. Roberto Freire, 2300 — Capim Macio, Natal/RN',
    motivo: 'atualizacao',
    criado_por: 'maurofilho@grupoarruda.com',
    criado_em: '2026-03-15T08:45:00.000Z',
  },
]

let ajustes: AjusteCadastro[] = [...SEED_AJUSTES]
const listeners = new Set<() => void>()

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

function emit() {
  listeners.forEach((l) => l())
}

function snapshot() {
  return ajustes
}

// ─── API mock ────────────────────────────────────────────────────────────────

export function adicionarAjuste(input: {
  cliente_id: string
  cliente_nome: string
  tipo: AjusteTipo
  valor_anterior: string
  valor_atual: string
  motivo: AjusteMotivo
  observacao?: string
}) {
  const novo: AjusteCadastro = {
    id: `aj-${Math.random().toString(36).slice(2, 8)}`,
    ...input,
    criado_por: 'maurofilho@grupoarruda.com',
    criado_em: new Date().toISOString(),
  }
  ajustes = [novo, ...ajustes]
  emit()
  return novo
}

export function reverterAjuste(id: string) {
  ajustes = ajustes.map((a) =>
    a.id === id
      ? {
          ...a,
          reverted_em: new Date().toISOString(),
          reverted_por: 'maurofilho@grupoarruda.com',
        }
      : a
  )
  emit()
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

export function useTodosAjustes(): AjusteCadastro[] {
  return useSyncExternalStore(subscribe, snapshot, snapshot)
}

export function useAjustesPorCliente(clienteId: string | undefined): AjusteCadastro[] {
  const todos = useTodosAjustes()
  if (!clienteId) return []
  return todos
    .filter((a) => a.cliente_id === clienteId)
    .sort((a, b) => b.criado_em.localeCompare(a.criado_em))
}
