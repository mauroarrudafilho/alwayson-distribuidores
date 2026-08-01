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

/** Sem seed: a UI começa vazia até haver ajustes reais. */
let ajustes: AjusteCadastro[] = []
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
    criado_por: 'contato@devtechlabs.com.br',
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
          reverted_por: 'contato@devtechlabs.com.br',
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
