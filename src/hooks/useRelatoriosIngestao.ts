import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { RelatorioIngestao } from '@/types/distribuidor'

export function useRelatoriosIngestao(distribuidorId?: string) {
  return useQuery({
    queryKey: ['relatorios-ingestao', distribuidorId],
    queryFn: async () => {
      let query = supabase
        .from('alwayson_relatorios_ingestao')
        .select('*')
        .order('criado_em', { ascending: false })
        .limit(50)

      if (distribuidorId) {
        query = query.eq('distribuidor_id', distribuidorId)
      }

      const { data, error } = await query
      if (error) throw error
      return (data ?? []) as RelatorioIngestao[]
    },
  })
}

export function useRelatoriosPendentes() {
  return useQuery({
    queryKey: ['relatorios-pendentes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('alwayson_relatorios_ingestao')
        .select('id')
        .in('status', ['pendente', 'processando'])
      if (error) throw error
      return (data ?? []).length
    },
  })
}

export function useDistribuidoresSemDadosRecentes() {
  return useQuery({
    queryKey: ['distribuidores-sem-dados'],
    queryFn: async () => {
      const seteDiasAtras = new Date()
      seteDiasAtras.setDate(seteDiasAtras.getDate() - 7)
      const dataLimite = seteDiasAtras.toISOString().split('T')[0]

      const { data: ultimaPerformance, error } = await supabase
        .from('alwayson_performance_periodo')
        .select('distribuidor_id')
        .gte('periodo_fim', dataLimite)

      if (error) throw error

      const distribuidoresComDados = new Set(
        (ultimaPerformance ?? []).map((p) => p.distribuidor_id)
      )

      const { data: distribuidoresAtivos, error: errDist } = await supabase
        .from('alwayson_distribuidores')
        .select('id')
        .eq('status', 'ativo')

      if (errDist) throw errDist

      const semDados = (distribuidoresAtivos ?? []).filter(
        (d) => !distribuidoresComDados.has(d.id)
      )

      return semDados.length
    },
  })
}
