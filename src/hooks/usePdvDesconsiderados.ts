import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface PdvDesconsiderado {
  cnpj: string
  motivo: string | null
  criado_em: string
}

function normalizaCnpj(raw: string) {
  return String(raw).replace(/\D/g, '').padStart(14, '0').slice(0, 14)
}

export function usePdvDesconsiderados() {
  return useQuery({
    queryKey: ['pdv-desconsiderados'],
    staleTime: 30_000,
    queryFn: async (): Promise<PdvDesconsiderado[]> => {
      const { data, error } = await supabase
        .from('alwayson_pdv_desconsiderados')
        .select('cnpj, motivo, criado_em')
        .order('criado_em', { ascending: false })
      if (error) {
        if (String(error.message).includes('alwayson_pdv_desconsiderados')) return []
        throw error
      }
      return (data ?? []) as PdvDesconsiderado[]
    },
  })
}

/** Set de CNPJs desconsiderados — uso em hooks Explorar. */
export async function carregarPdvDesconsideradosSet(): Promise<Set<string>> {
  const { data, error } = await supabase.from('alwayson_pdv_desconsiderados').select('cnpj')
  if (error) {
    if (String(error.message).includes('alwayson_pdv_desconsiderados')) {
      return new Set()
    }
    throw error
  }
  return new Set((data ?? []).map((r) => normalizaCnpj(String(r.cnpj))))
}

export function useDesconsiderarPdv() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (args: { cnpj: string; motivo?: string }) => {
      const cnpj = normalizaCnpj(args.cnpj)
      if (cnpj.length !== 14) return
      const { error } = await supabase.from('alwayson_pdv_desconsiderados').upsert(
        {
          cnpj,
          motivo: args.motivo?.trim() || 'fora_do_mix',
        },
        { onConflict: 'cnpj' }
      )
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['pdv-desconsiderados'] })
      void qc.invalidateQueries({ queryKey: ['explorar-cobertura'] })
      void qc.invalidateQueries({ queryKey: ['explorar-cobertura-detalhe'] })
      void qc.invalidateQueries({ queryKey: ['explorar-prioridade'] })
      void qc.invalidateQueries({ queryKey: ['explorar-mapa'] })
    },
  })
}

export function useRestaurarPdv() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (cnpj: string) => {
      const key = normalizaCnpj(cnpj)
      if (key.length !== 14) return
      const { error } = await supabase
        .from('alwayson_pdv_desconsiderados')
        .delete()
        .eq('cnpj', key)
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['pdv-desconsiderados'] })
      void qc.invalidateQueries({ queryKey: ['explorar-cobertura'] })
      void qc.invalidateQueries({ queryKey: ['explorar-cobertura-detalhe'] })
      void qc.invalidateQueries({ queryKey: ['explorar-prioridade'] })
      void qc.invalidateQueries({ queryKey: ['explorar-mapa'] })
    },
  })
}
