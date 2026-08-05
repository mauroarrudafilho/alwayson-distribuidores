import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { ClienteDistribuidor } from '@/types/distribuidor'
import type {
  ClienteEstrategico,
  ClienteEstrategicoLinha,
  CriterioEstrategicoConfig,
  PrioridadeEstrategica,
} from '@/types/clientes-estrategicos'

const KEY = 'clientes-estrategicos' as const

/**
 * Lista curada de clientes estratégicos.
 *
 * A lista existe mesmo sem nenhum critério de acompanhamento configurado — o
 * monitoramento é uma camada por cima, não a condição de existência.
 *
 * `prioridade` é curva ABC por UF (migration 064), não opinião de quem
 * cadastrou.
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
      // O PostgREST corta em `db-max-rows` (1000 no Supabase) e `.limit()` não
      // ultrapassa isso — com 1.327 linhas a lista vinha truncada em silêncio.
      // Só `.range()` em blocos traz o conjunto inteiro.
      const TAMANHO_BLOCO = 1000
      const todas: ClienteEstrategicoLinha[] = []

      for (let inicio = 0; ; inicio += TAMANHO_BLOCO) {
        let query = supabase
          .from('alwayson_clientes_estrategicos_v_lista')
          .select('*')
          .order('estado_exibicao')
          .order('cidade_exibicao')
          .order('cnpj')
          .range(inicio, inicio + TAMANHO_BLOCO - 1)
        if (!includeInativos) query = query.eq('ativo', true)
        if (distribuidorId) query = query.eq('distribuidor_id', distribuidorId)

        const { data, error } = await query
        if (error) throw error

        const bloco = (data ?? []) as ClienteEstrategicoLinha[]
        todas.push(...bloco)
        if (bloco.length < TAMANHO_BLOCO) break
      }

      return todas
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
      // Mesmo teto de 1000 do PostgREST — pagina para não truncar em silêncio.
      const TAMANHO_BLOCO = 1000
      const ids = new Set<string>()

      for (let inicio = 0; ; inicio += TAMANHO_BLOCO) {
        const { data, error } = await supabase
          .from('alwayson_clientes_estrategicos')
          .select('cliente_id')
          .eq('ativo', true)
          .not('cliente_id', 'is', null)
          .range(inicio, inicio + TAMANHO_BLOCO - 1)
        if (error) throw error

        const bloco = data ?? []
        for (const r of bloco) ids.add(r.cliente_id as string)
        if (bloco.length < TAMANHO_BLOCO) break
      }

      return ids
    },
  })
}

export interface GeoFilaEstrategicos {
  total: number
  com_coordenada: number
  pendentes: number
  em_processamento: number
  concluidos: number
  sem_fonte: number
  com_erro: number
}

/** Contadores da fila de geocodificação (migration 066). */
export function useGeoFilaEstrategicos() {
  return useQuery({
    queryKey: [KEY, 'geo-fila'],
    queryFn: async (): Promise<GeoFilaEstrategicos> => {
      const { data, error } = await supabase
        .from('alwayson_clientes_estrategicos_v_geo_fila')
        .select('*')
        .maybeSingle()
      if (error) throw error
      return (data ?? {
        total: 0,
        com_coordenada: 0,
        pendentes: 0,
        em_processamento: 0,
        concluidos: 0,
        sem_fonte: 0,
        com_erro: 0,
      }) as GeoFilaEstrategicos
    },
  })
}

export interface GeoLoteResultado {
  ok: boolean
  error?: string
  message?: string
  processed?: number
  sem_fonte?: number
  skipped?: number
  failed?: number
  requeued?: number
  fila?: GeoFilaEstrategicos | null
}

/**
 * Roda **um lote** do worker `enrich-estrategicos-geo`.
 *
 * O lote é curto (a Edge Function tem tecto de tempo e o Nominatim pede ~1s
 * entre chamadas), por isso quem chama encadeia lotes — ver
 * `ClientesEstrategicosGeoCard`. A chamada é sempre a mesma; o que muda é o
 * corpo.
 */
export function useRodarLoteGeoEstrategicos() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (
      body: { limit?: number; uf?: string; cnpj?: string; requeue?: string } = {}
    ): Promise<GeoLoteResultado> => {
      const { data, error } = await supabase.functions.invoke<GeoLoteResultado>(
        'enrich-estrategicos-geo',
        { body }
      )
      if (error) throw new Error(error.message ?? 'Erro ao chamar a Edge Function.')
      if (!data) throw new Error('Resposta vazia da Edge Function.')
      if (!data.ok) {
        const code = data.error ?? 'desconhecido'
        if (code === 'forbidden') throw new Error('Sem permissão (apenas admin global).')
        if (code === 'missing_auth') throw new Error('Sessão expirada — entre novamente.')
        throw new Error(`Função: ${code}`)
      }
      return data
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [KEY] })
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
            prioridade: valores.prioridade,
            observacao: valores.observacao,
            cidade: valores.cidade,
            estado: valores.estado,
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
