import { useMemo } from 'react'
import { MOCK_TODOS_CLIENTES, MOCK_CLIENTE_HISTORICO } from '@/hooks/useMockInsights'
import type { InsightsTopCliente } from '@/types/insights'

function digits(cnpj: string | null | undefined) {
  return (cnpj ?? '').replace(/\D/g, '')
}

/**
 * Verifica se um cliente (pelo CNPJ) tem dados no módulo Insights.
 * Mock-only: compara pelos dígitos, retorna o registro Insights se existir
 * + métricas resumidas (faturamento, NFs) para uso no popover comparativo.
 */
export function useClienteEmInsights(cnpj: string | null | undefined) {
  return useMemo(() => {
    const target = digits(cnpj)
    if (target.length === 0) {
      return { existe: false as const }
    }
    const cliente = MOCK_TODOS_CLIENTES.find(
      (c) => digits(c.cnpj_cliente) === target
    )
    if (!cliente) {
      return { existe: false as const }
    }
    const historico = MOCK_CLIENTE_HISTORICO[cliente.cnpj_cliente] ?? []
    const ultimoMes = historico[historico.length - 1]
    return {
      existe: true as const,
      cliente: cliente as InsightsTopCliente,
      historico,
      ultimoMes,
    }
  }, [cnpj])
}
