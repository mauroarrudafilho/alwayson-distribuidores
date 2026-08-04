import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { ClienteDistribuidor } from '@/types/distribuidor'
import type {
  ClienteEstrategico,
  ClienteEstrategicoLinha,
  CriterioEstrategicoConfig,
  OrigemEstrategica,
  PrioridadeEstrategica,
} from '@/types/clientes-estrategicos'

const KEY = 'clientes-estrategicos' as const

/**
 * Lista curada de clientes estratégicos.
 *
 * É **cadastro manual**, não derivação: cada linha entrou porque alguém decidiu
 * e escreveu o motivo. Por isso a lista existe mesmo sem nenhum critério de
 * acompanhamento configurado — o monitoramento é uma camada por cima, não a
 * condição de existência.
 *
 * Lê pela **view** `_v_lista` (migration 062), não pela tabela: é ela que
 * resolve nome e praça a partir de fonte pública para os CNPJs que ainda não
 * são cliente de ninguém. Ler a tabela crua devolve linhas sem nome.
 *
 * Escrita depende das policies de escopo: o PostgREST devolve zero linhas sem
 * erro quando a RLS bloqueia, então toda mutação confere o retorno.
 */
export function useClientesEstrategicos(
  distribuidorId?: string,
  includeInativos = false
) {
  return useQuery({
    queryKey: [KEY, 'lista', distribuidorId ?? 'todos', includeInativos],
    queryFn: async (): Promise<ClienteEstrategicoLinha[]> => {
      let query = supabase
        .from('alwayson_clientes_estrategicos_v_lista')
        .select('*')
        .order('estado_exibicao')
        .order('cidade_exibicao')
        .order('cnpj')
        .limit(5000)
      if (!includeInativos) query = query.eq('ativo', true)
      if (distribuidorId) query = query.eq('distribuidor_id', distribuidorId)
      const { data, error } = await query
      if (error) throw error
      return (data ?? []) as ClienteEstrategicoLinha[]
    },
  })
}

/**
 * Só os `cliente_id` — para marcar o cliente como estratégico noutras telas.
 * Ignora as linhas territoriais, que por definição não têm cliente ligado.
 */
export function useIdsEstrategicos() {
  return useQuery({
    queryKey: [KEY, 'ids'],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await supabase
        .from('alwayson_clientes_estrategicos')
        .select('cliente_id')
        .eq('ativo', true)
        .not('cliente_id', 'is', null)
      if (error) throw error
      return new Set((data ?? []).map((r) => r.cliente_id as string))
    },
  })
}

export function useCriteriosEstrategicos(
  distribuidorId?: string,
  includeInativos = false
) {
  return useQuery({
    queryKey: [KEY, 'criterios', distribuidorId ?? 'todos', includeInativos],
    queryFn: async (): Promise<CriterioEstrategicoConfig[]> => {
      let query = supabase
        .from('alwayson_clientes_estrategicos_config')
        .select('*')
        .order('ordem')
      if (!includeInativos) query = query.eq('ativo', true)
      if (distribuidorId) query = query.eq('distribuidor_id', distribuidorId)
      const { data, error } = await query
      if (error) throw error
      return (data ?? []) as CriterioEstrategicoConfig[]
    },
  })
}

/**
 * Clientes elegíveis para entrar na lista: a carteira do distribuidor menos
 * quem já está lá. Sem `distribuidorId` não há o que oferecer — o vínculo é
 * sempre (distribuidor, cliente).
 */
export function useClientesDisponiveis(
  distribuidorId: string | undefined,
  jaNaLista: string[]
) {
  return useQuery({
    queryKey: [KEY, 'disponiveis', distribuidorId, jaNaLista.length],
    enabled: !!distribuidorId,
    queryFn: async (): Promise<ClienteDistribuidor[]> => {
      const { data, error } = await supabase
        .from('alwayson_clientes_distribuidor')
        .select('*')
        .eq('distribuidor_id', distribuidorId!)
        .order('razao_social')
      if (error) throw error
      const excluir = new Set(jaNaLista)
      return ((data ?? []) as ClienteDistribuidor[]).filter((c) => !excluir.has(c.id))
    },
  })
}

export interface ClienteEstrategicoInput {
  /** Só dígitos. É a chave — o resto é opcional. */
  cnpj: string
  /** NULL = alvo territorial, sem parceiro dono. */
  distribuidor_id: string | null
  cidade: string | null
  estado: string | null
  motivo: string
  origem: OrigemEstrategica | null
  prioridade: PrioridadeEstrategica
  observacao: string | null
}

export function apenasDigitos(v: string): string {
  return v.replace(/\D/g, '')
}

function semLinhas(): never {
  throw new Error(
    'Nenhuma linha foi gravada — provavelmente falta permissão de administrador.'
  )
}

export function useSalvarClienteEstrategico() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (args: {
      id?: string
      valores: ClienteEstrategicoInput
    }): Promise<ClienteEstrategico> => {
      const { id, valores } = args

      if (id) {
        // Edição não mexe no par (distribuidor, cliente) — só na curadoria.
        const { data, error } = await supabase
          .from('alwayson_clientes_estrategicos')
          .update({
            motivo: valores.motivo,
            origem: valores.origem,
            prioridade: valores.prioridade,
            observacao: valores.observacao,
          })
          .eq('id', id)
          .select('*')
        if (error) throw error
        if (!data || data.length === 0) semLinhas()
        return data[0] as ClienteEstrategico
      }

      const { data: sessao } = await supabase.auth.getUser()

      const { data, error } = await supabase
        .from('alwayson_clientes_estrategicos')
        .insert({
          ...valores,
          ativo: true,
          removido_em: null,
          adicionado_por: sessao.user?.id ?? null,
        })
        .select('*')

      if (error) {
        // A chave é o CNPJ (migration 062): readicionar um alvo removido deve
        // reativar, não estourar.
        if (error.code === '23505') {
          let reativar = supabase
            .from('alwayson_clientes_estrategicos')
            .update({
              ativo: true,
              removido_em: null,
              motivo: valores.motivo,
              origem: valores.origem,
              prioridade: valores.prioridade,
              observacao: valores.observacao,
            })
            .eq('cnpj', valores.cnpj)
          reativar = valores.distribuidor_id
            ? reativar.eq('distribuidor_id', valores.distribuidor_id)
            : reativar.is('distribuidor_id', null)

          const { data: reativado, error: erroReativar } = await reativar.select('*')
          if (erroReativar) throw erroReativar
          if (!reativado || reativado.length === 0) semLinhas()
          return reativado[0] as ClienteEstrategico
        }
        throw error
      }

      if (!data || data.length === 0) semLinhas()
      return data[0] as ClienteEstrategico
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [KEY] })
      void qc.invalidateQueries({ queryKey: ['dashboard-kpis'] })
    },
  })
}

/** Saída da lista é soft: preserva o histórico de quem foi estratégico e quando. */
export function useRemoverClienteEstrategico() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from('alwayson_clientes_estrategicos')
        .update({ ativo: false, removido_em: new Date().toISOString() })
        .eq('id', id)
        .select('id')
      if (error) throw error
      if (!data || data.length === 0) semLinhas()
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [KEY] })
      void qc.invalidateQueries({ queryKey: ['dashboard-kpis'] })
    },
  })
}
