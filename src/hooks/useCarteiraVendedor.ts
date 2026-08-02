import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

/**
 * Carteira de clientes por vendedor.
 *
 * Serve a **correção pontual** — remanejar um cliente que ficou com o vendedor
 * errado. A carga da base continua pelo template `clientes` da ingestão; esta
 * tela não substitui isso.
 *
 * A escrita depende da policy de UPDATE da migration `051`: antes dela o
 * PostgREST devolvia 0 linhas afetadas sem erro, e a tela diria que gravou.
 */
export interface ClienteDaCarteira {
  id: string
  cnpj: string
  razao_social: string
  nome_fantasia: string | null
  cidade: string | null
  estado: string | null
  vendedor_id: string | null
}

const KEY = 'carteira-vendedor' as const

/** Quantos clientes cada vendedor tem — alimenta o contador ao lado do nome. */
export function useCarteiraContagem(distribuidorId: string | undefined) {
  return useQuery({
    queryKey: [KEY, 'contagem', distribuidorId],
    enabled: !!distribuidorId,
    queryFn: async (): Promise<Map<string, number>> => {
      const { data, error } = await supabase
        .from('alwayson_clientes_distribuidor')
        .select('vendedor_id')
        .eq('distribuidor_id', distribuidorId!)
      if (error) throw error

      const m = new Map<string, number>()
      for (const r of data ?? []) {
        const v = (r.vendedor_id as string | null) ?? '__sem_vendedor__'
        m.set(v, (m.get(v) ?? 0) + 1)
      }
      return m
    },
  })
}

export function useClientesDoVendedor(vendedorId: string | undefined) {
  return useQuery({
    queryKey: [KEY, 'clientes', vendedorId],
    enabled: !!vendedorId,
    queryFn: async (): Promise<ClienteDaCarteira[]> => {
      const { data, error } = await supabase
        .from('alwayson_clientes_distribuidor')
        .select('id, cnpj, razao_social, nome_fantasia, cidade, estado, vendedor_id')
        .eq('vendedor_id', vendedorId!)
        .order('razao_social')
      if (error) throw error
      return data as ClienteDaCarteira[]
    },
  })
}

export function useReatribuirCliente() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (args: { clienteId: string; novoVendedorId: string }) => {
      const { data, error } = await supabase
        .from('alwayson_clientes_distribuidor')
        .update({ vendedor_id: args.novoVendedorId })
        .eq('id', args.clienteId)
        .select('id')

      if (error) throw error
      // RLS bloqueando não gera erro — devolve zero linhas. Sem esta checagem a
      // tela reportaria sucesso e nada teria mudado.
      if (!data || data.length === 0) {
        throw new Error(
          'Nenhuma linha foi alterada — provavelmente falta permissão de administrador.',
        )
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [KEY] })
      void qc.invalidateQueries({ queryKey: ['clientes'] })
      void qc.invalidateQueries({ queryKey: ['distribuidor-area'] })
    },
  })
}
