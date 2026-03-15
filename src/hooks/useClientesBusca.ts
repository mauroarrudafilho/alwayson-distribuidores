import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { ClienteDistribuidor } from '@/types/distribuidor'

export function useClientesBusca(search: string) {
  return useQuery({
    queryKey: ['clientes-busca', search],
    queryFn: async () => {
      const term = `%${search}%`
      const { data, error } = await supabase
        .from('alwayson_clientes_distribuidor')
        .select('*')
        .or(`cnpj.ilike.${term},razao_social.ilike.${term},nome_fantasia.ilike.${term}`)
        .order('razao_social')
        .limit(50)
      if (error) throw error
      return data as ClienteDistribuidor[]
    },
    enabled: search.length >= 3,
  })
}
