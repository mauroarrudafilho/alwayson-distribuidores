import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { ClienteDistribuidor } from '@/types/distribuidor'

export function useClientesBusca(search: string) {
  return useQuery({
    queryKey: ['clientes-busca', search],
    queryFn: async () => {
      let query = supabase
        .from('alwayson_clientes_distribuidor')
        .select('*')

      if (search.length > 0) {
        const term = `%${search}%`
        query = query.or(`cnpj.ilike.${term},razao_social.ilike.${term},nome_fantasia.ilike.${term}`)
      }

      const { data, error } = await query
        .order('razao_social')
        .limit(50)

      if (error) throw error
      return data as ClienteDistribuidor[]
    },
  })
}
