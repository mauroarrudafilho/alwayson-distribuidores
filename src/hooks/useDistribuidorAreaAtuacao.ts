import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Distribuidor } from '@/types/distribuidor'

/**
 * Dimensionamento da praça de um distribuidor (view da migration 046).
 *
 * `potencial_demonstrado` vem do **histórico Insights (jan/2022–dez/2024)** das
 * cidades atribuídas — é benchmark do que a praça já entregou na operação
 * anterior, nunca meta corrente. Ver `docs/ROADMAP.md`.
 */
export interface AreaAtuacao {
  distribuidor_id: string
  cidades_atuacao: number
  populacao_coberta: number
  potencial_demonstrado: number
  pdvs_no_historico: number
  carteira_declarada: number | null
  carteira_cadastrada: number
}

export interface MunicipioIbge {
  codigo_ibge: number
  cidade_exibicao: string
  estado: string
  populacao: number | null
}

const KEY = 'distribuidor-area' as const

export function useAreaAtuacao(distribuidorId: string | undefined) {
  return useQuery({
    queryKey: [KEY, 'resumo', distribuidorId],
    enabled: !!distribuidorId,
    queryFn: async (): Promise<AreaAtuacao | null> => {
      const { data, error } = await supabase
        .from('alwayson_distribuidor_v_area_atuacao')
        .select('*')
        .eq('distribuidor_id', distribuidorId!)
        .maybeSingle()
      if (error) throw error
      return data as AreaAtuacao | null
    },
  })
}

/** Cidades já atribuídas ao distribuidor, com nome e população. */
export function useCidadesDoDistribuidor(distribuidorId: string | undefined) {
  return useQuery({
    queryKey: [KEY, 'cidades', distribuidorId],
    enabled: !!distribuidorId,
    queryFn: async (): Promise<MunicipioIbge[]> => {
      const { data: vinculos, error } = await supabase
        .from('alwayson_distribuidor_cidades')
        .select('codigo_ibge')
        .eq('distribuidor_id', distribuidorId!)
      if (error) throw error

      const codigos = (vinculos ?? []).map((v) => v.codigo_ibge as number)
      if (codigos.length === 0) return []

      const { data: municipios, error: erroMun } = await supabase
        .from('alwayson_ibge_municipio_populacao')
        .select('codigo_ibge, cidade_exibicao, estado, populacao')
        .in('codigo_ibge', codigos)
        .order('cidade_exibicao')
      if (erroMun) throw erroMun
      return municipios as MunicipioIbge[]
    },
  })
}

/**
 * Busca de municípios para o seletor. Exige termo com 2+ caracteres para não
 * puxar os ~920 registros a cada tecla.
 */
export function useBuscaMunicipios(termo: string, uf?: string) {
  const busca = termo.trim()
  return useQuery({
    queryKey: [KEY, 'busca-municipios', busca, uf],
    enabled: busca.length >= 2,
    queryFn: async (): Promise<MunicipioIbge[]> => {
      let q = supabase
        .from('alwayson_ibge_municipio_populacao')
        .select('codigo_ibge, cidade_exibicao, estado, populacao')
        .ilike('cidade_exibicao', `%${busca}%`)
        .order('cidade_exibicao')
        .limit(20)
      if (uf) q = q.eq('estado', uf)
      const { data, error } = await q
      if (error) throw error
      return data as MunicipioIbge[]
    },
  })
}

function invalidarArea(qc: ReturnType<typeof useQueryClient>) {
  return () => {
    void qc.invalidateQueries({ queryKey: [KEY] })
    void qc.invalidateQueries({ queryKey: ['distribuidores'] })
  }
}

export function useAdicionarCidade() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (args: { distribuidorId: string; codigoIbge: number }) => {
      const { data: userResp } = await supabase.auth.getUser()
      const { error } = await supabase.from('alwayson_distribuidor_cidades').insert({
        distribuidor_id: args.distribuidorId,
        codigo_ibge: args.codigoIbge,
        criado_por: userResp.user?.id ?? null,
      })
      // Cidade já atribuída (unique) não é erro para o utilizador.
      if (error && error.code !== '23505') throw error
    },
    onSuccess: invalidarArea(qc),
  })
}

export function useRemoverCidade() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (args: { distribuidorId: string; codigoIbge: number }) => {
      const { error } = await supabase
        .from('alwayson_distribuidor_cidades')
        .delete()
        .eq('distribuidor_id', args.distribuidorId)
        .eq('codigo_ibge', args.codigoIbge)
      if (error) throw error
    },
    onSuccess: invalidarArea(qc),
  })
}

export function useAtualizarDimensionamento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (args: {
      distribuidorId: string
      carteira_declarada: number | null
      frequencia_visita: Distribuidor['frequencia_visita']
      inicio_parceria: string | null
    }) => {
      const { error } = await supabase
        .from('alwayson_distribuidores')
        .update({
          carteira_declarada: args.carteira_declarada,
          frequencia_visita: args.frequencia_visita,
          inicio_parceria: args.inicio_parceria,
        })
        .eq('id', args.distribuidorId)
      if (error) throw error
    },
    onSuccess: invalidarArea(qc),
  })
}
