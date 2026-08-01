import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

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
  observacao: string | null
  /** E-mail de quem registrou (resolvido via alwayson_user_profiles); '—' se não encontrado. */
  criado_por: string
  criado_em: string
  reverted_em: string | null
  /** E-mail de quem reverteu; null enquanto o ajuste segue ativo. */
  reverted_por: string | null
}

interface AjusteCadastroRow {
  id: string
  cliente_id: string
  tipo: AjusteTipo
  valor_anterior: string
  valor_atual: string
  motivo: AjusteMotivo
  observacao: string | null
  criado_por: string | null
  criado_em: string
  reverted_em: string | null
  reverted_por: string | null
  cliente: { nome_fantasia: string | null; razao_social: string } | null
}

const KEY = 'ajustes-cadastro' as const

/** `alwayson_clientes_ajustes_cadastro` guarda o UUID de `auth.users`; resolvemos
 * para e-mail via `alwayson_user_profiles` (sem FK direta entre as duas tabelas,
 * então não dá pra usar embed do PostgREST — uma query separada e um Map). */
async function buscarEmailsPorUserId(): Promise<Map<string, string>> {
  const { data, error } = await supabase.from('alwayson_user_profiles').select('user_id, email')
  if (error) throw error
  return new Map(data.map((p) => [p.user_id as string, p.email as string]))
}

function toAjusteCadastro(row: AjusteCadastroRow, emails: Map<string, string>): AjusteCadastro {
  const { cliente, criado_por, reverted_por, ...rest } = row
  return {
    ...rest,
    cliente_nome: cliente?.nome_fantasia || cliente?.razao_social || '—',
    criado_por: (criado_por && emails.get(criado_por)) || '—',
    reverted_por: reverted_por ? (emails.get(reverted_por) ?? '—') : null,
  }
}

const SELECT_COM_CLIENTE = `
  id, cliente_id, tipo, valor_anterior, valor_atual, motivo, observacao,
  criado_por, criado_em, reverted_em, reverted_por,
  cliente:alwayson_clientes_distribuidor(nome_fantasia, razao_social)
`

/** Todos os ajustes de cadastro (todos os clientes), mais recentes primeiro. */
export function useTodosAjustes() {
  return useQuery({
    queryKey: [KEY, 'todos'],
    queryFn: async (): Promise<AjusteCadastro[]> => {
      const [{ data, error }, emails] = await Promise.all([
        supabase
          .from('alwayson_clientes_ajustes_cadastro')
          .select(SELECT_COM_CLIENTE)
          .order('criado_em', { ascending: false }),
        buscarEmailsPorUserId(),
      ])
      if (error) throw error
      return (data as unknown as AjusteCadastroRow[]).map((r) => toAjusteCadastro(r, emails))
    },
  })
}

/** Ajustes de um cliente específico, mais recentes primeiro. */
export function useAjustesPorCliente(clienteId: string | undefined) {
  return useQuery({
    queryKey: [KEY, 'cliente', clienteId],
    enabled: !!clienteId,
    queryFn: async (): Promise<AjusteCadastro[]> => {
      const [{ data, error }, emails] = await Promise.all([
        supabase
          .from('alwayson_clientes_ajustes_cadastro')
          .select(SELECT_COM_CLIENTE)
          .eq('cliente_id', clienteId!)
          .order('criado_em', { ascending: false }),
        buscarEmailsPorUserId(),
      ])
      if (error) throw error
      return (data as unknown as AjusteCadastroRow[]).map((r) => toAjusteCadastro(r, emails))
    },
  })
}

export function useAdicionarAjuste() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      cliente_id: string
      tipo: AjusteTipo
      valor_anterior: string
      valor_atual: string
      motivo: AjusteMotivo
      observacao?: string
    }) => {
      const { data: userResp } = await supabase.auth.getUser()
      const { error } = await supabase.from('alwayson_clientes_ajustes_cadastro').insert({
        cliente_id: input.cliente_id,
        tipo: input.tipo,
        valor_anterior: input.valor_anterior,
        valor_atual: input.valor_atual,
        motivo: input.motivo,
        observacao: input.observacao ?? null,
        criado_por: userResp.user?.id ?? null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [KEY] })
    },
  })
}

export function useReverterAjuste() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data: userResp } = await supabase.auth.getUser()
      const { error } = await supabase
        .from('alwayson_clientes_ajustes_cadastro')
        .update({
          reverted_em: new Date().toISOString(),
          reverted_por: userResp.user?.id ?? null,
        })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [KEY] })
    },
  })
}
