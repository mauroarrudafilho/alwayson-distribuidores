import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/auth'
import { insightsCnpjKey } from '@/hooks/useInsightsQueries'

export type InsightsAcaoEstado =
  | 'pendente'
  | 'em_acao'
  | 'resolvido'
  | 'snooze'
  | 'arquivado'

export interface InsightsAcao {
  id: string
  tenant_id: string
  cnpj_cliente: string
  estado: InsightsAcaoEstado
  motivo: string | null
  snooze_until: string | null
  criado_por: string | null
  atualizado_por: string | null
  criado_em: string
  atualizado_em: string
}

const KEY = 'insights-acoes' as const

/** Lê todas as ações do tenant atual. Vazio se não há tenant selecionado. */
export function useInsightsAcoes() {
  const { currentTenant } = useAuth()
  return useQuery({
    queryKey: [KEY, currentTenant?.tenant_id],
    enabled: !!currentTenant?.tenant_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('alwayson_insights_acoes')
        .select('*')
        .eq('tenant_id', currentTenant!.tenant_id)
      if (error) throw error
      return data as InsightsAcao[]
    },
  })
}

/** Mapa CNPJ-normalizado → ação corrente do tenant. */
export function useInsightsAcoesByCnpj() {
  const { data } = useInsightsAcoes()
  return useMemo(() => {
    const m = new Map<string, InsightsAcao>()
    for (const a of data ?? []) {
      m.set(insightsCnpjKey(a.cnpj_cliente), a)
    }
    return m
  }, [data])
}

/**
 * Upsert de ação. INSERT se não existe (set criado_por), UPDATE caso contrário
 * (preserva criado_por original, só toca campos da mutação + atualizado_por).
 *
 * CNPJ é normalizado para 14 dígitos antes de gravar.
 */
export function useUpsertInsightsAcao() {
  const qc = useQueryClient()
  const { currentTenant } = useAuth()
  return useMutation({
    mutationFn: async (args: {
      cnpj_cliente: string
      estado: InsightsAcaoEstado
      motivo?: string | null
      snooze_until?: string | null
    }) => {
      if (!currentTenant?.tenant_id) {
        throw new Error('Selecione um tenant antes de marcar a ação.')
      }
      const tenantId = currentTenant.tenant_id
      const cnpj = insightsCnpjKey(args.cnpj_cliente)
      if (cnpj.length !== 14) throw new Error('CNPJ inválido.')

      const { data: userResp } = await supabase.auth.getUser()
      const userId = userResp.user?.id ?? null

      const { data: existing, error: selErr } = await supabase
        .from('alwayson_insights_acoes')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('cnpj_cliente', cnpj)
        .maybeSingle()
      if (selErr) throw selErr

      if (existing?.id) {
        const { error } = await supabase
          .from('alwayson_insights_acoes')
          .update({
            estado: args.estado,
            motivo: args.motivo ?? null,
            snooze_until: args.snooze_until ?? null,
            atualizado_por: userId,
          })
          .eq('id', existing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('alwayson_insights_acoes').insert({
          tenant_id: tenantId,
          cnpj_cliente: cnpj,
          estado: args.estado,
          motivo: args.motivo ?? null,
          snooze_until: args.snooze_until ?? null,
          criado_por: userId,
          atualizado_por: userId,
        })
        if (error) throw error
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [KEY] })
    },
  })
}
