import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Distribuidor } from '@/types/distribuidor'

export function useDistribuidores() {
  return useQuery({
    queryKey: ['distribuidores'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('alwayson_distribuidores')
        .select('*')
        .order('nome')
      if (error) throw error
      return data as Distribuidor[]
    },
  })
}

export interface FornecedorTenant {
  id: string
  nome: string
}

/**
 * Fornecedores que atendem um distribuidor (migration 047).
 *
 * A ingestão carimba `fornecedor_tenant_id` e o backend só aceita um fornecedor
 * com relação comercial ativa — por isso o seletor oferece apenas os vinculados,
 * em vez de todos os tenants do tipo.
 */
export function useFornecedoresDoDistribuidor(distribuidorId: string | undefined) {
  return useQuery({
    queryKey: ['fornecedores-do-distribuidor', distribuidorId],
    enabled: !!distribuidorId,
    queryFn: async (): Promise<FornecedorTenant[]> => {
      const { data: vinculos, error } = await supabase
        .from('alwayson_fornecedor_distribuidores')
        .select('fornecedor_tenant_id')
        .eq('distribuidor_id', distribuidorId!)
        .eq('ativo', true)
      if (error) throw error

      const ids = (vinculos ?? []).map((v) => v.fornecedor_tenant_id as string)
      if (ids.length === 0) return []

      const { data: tenants, error: erroTenants } = await supabase
        .from('alwayson_tenants')
        .select('id, nome')
        .in('id', ids)
        .order('nome')
      if (erroTenants) throw erroTenants
      return tenants as FornecedorTenant[]
    },
  })
}

export function useDistribuidor(id: string | undefined) {
  return useQuery({
    queryKey: ['distribuidores', id],
    queryFn: async () => {
      if (!id) throw new Error('ID required')
      const { data, error } = await supabase
        .from('alwayson_distribuidores')
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw error
      return data as Distribuidor
    },
    enabled: !!id,
  })
}
