import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { nomePdv } from '@/lib/pdv'
import { labelSegmentoCnae } from '@/lib/pdvCnaeSegmento'

export interface PdvDesconsiderado {
  cnpj: string
  motivo: string | null
  criado_em: string
}

export interface PdvDesconsideradoDetalhe extends PdvDesconsiderado {
  nome: string
  bairro: string | null
  municipio: string | null
  uf: string | null
  segmento_cnae: string
}

function normalizaCnpj(raw: string) {
  return String(raw).replace(/\D/g, '').padStart(14, '0').slice(0, 14)
}

export function usePdvDesconsideradosDetalhe() {
  return useQuery({
    queryKey: ['pdv-desconsiderados', 'detalhe'],
    staleTime: 30_000,
    queryFn: async (): Promise<PdvDesconsideradoDetalhe[]> => {
      const { data, error } = await supabase
        .from('alwayson_pdv_desconsiderados')
        .select(
          `
          cnpj,
          motivo,
          criado_em,
          alwayson_pdv_universo (
            nome_fantasia,
            razao_social,
            bairro,
            municipio,
            uf,
            cnae_principal
          )
        `
        )
        .order('criado_em', { ascending: false })
      if (error) {
        if (String(error.message).includes('alwayson_pdv_desconsiderados')) return []
        throw error
      }

      return (data ?? []).map((row) => {
        const raw = row.alwayson_pdv_universo
        const u = (Array.isArray(raw) ? raw[0] : raw) as {
          nome_fantasia: string | null
          razao_social: string | null
          bairro: string | null
          municipio: string | null
          uf: string | null
          cnae_principal: string | null
        } | null
        return {
          cnpj: row.cnpj,
          motivo: row.motivo,
          criado_em: row.criado_em,
          nome: nomePdv(u?.nome_fantasia, u?.razao_social),
          bairro: u?.bairro ?? null,
          municipio: u?.municipio ?? null,
          uf: u?.uf ?? null,
          segmento_cnae: labelSegmentoCnae(u?.cnae_principal),
        }
      })
    },
  })
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
