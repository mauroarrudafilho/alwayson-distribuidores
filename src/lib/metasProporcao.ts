import { monthEnd, monthStart } from '@/lib/periodo'
import { formatCurrency } from '@/lib/format'
import type { Meta } from '@/types/distribuidor'
import type { Vendedor } from '@/types/distribuidor'

export function limitesDoMes(mes: string): { inicio: string; fim: string } {
  return { inicio: monthStart(mes), fim: monthEnd(mes) }
}

export function mesmoMesAnoAnterior(mes: string): string {
  const [ano, m] = mes.split('-').map(Number)
  return `${ano - 1}-${String(m).padStart(2, '0')}`
}

export interface LinhaMetaDraft {
  id: string | null
  hierarquia: Meta['hierarquia']
  nome: string
  parentId: string | null
  historico: number
  valor: string
}

/** Divide `total` proporcionalmente ao histórico; se tudo zero, reparte igual. */
export function splitProporcional(
  total: number,
  itens: { id: string; historico: number }[]
): Map<string, number> {
  const out = new Map<string, number>()
  if (itens.length === 0) return out

  const soma = itens.reduce((s, i) => s + Math.max(0, i.historico), 0)
  if (soma <= 0) {
    const cada = Math.round((total / itens.length) * 100) / 100
    let resto = Math.round(total * 100) / 100
    for (let i = 0; i < itens.length; i++) {
      const v = i === itens.length - 1 ? resto : cada
      out.set(itens[i].id, v)
      resto = Math.round((resto - v) * 100) / 100
    }
    return out
  }

  let acumulado = 0
  for (let i = 0; i < itens.length; i++) {
    const item = itens[i]
    if (i === itens.length - 1) {
      out.set(item.id, Math.round((total - acumulado) * 100) / 100)
    } else {
      const v = Math.round(((total * item.historico) / soma) * 100) / 100
      out.set(item.id, v)
      acumulado += v
    }
  }
  return out
}

export function historicoSubarvore(
  raizId: string,
  vendedores: Vendedor[],
  direto: Map<string, number>
): number {
  let sum = direto.get(raizId) ?? 0
  for (const v of vendedores.filter((x) => x.supervisor_id === raizId)) {
    sum += historicoSubarvore(v.id, vendedores, direto)
  }
  return sum
}

export function parseValorMeta(raw: string): number | null {
  const cleaned = String(raw)
    .replace(/[^\d,.-]/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .trim()
  const n = Number(cleaned)
  return Number.isFinite(n) && n > 0 ? n : null
}

export function formatValorInput(n: number, moeda = false): string {
  const v = Math.round(n * 100) / 100
  return moeda ? formatCurrency(v) : String(v)
}

/** Normaliza digitação/cola para exibição no input de meta. */
export function normalizarValorMetaInput(raw: string, moeda: boolean): string {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return ''
  return formatValorInput(Number(digits), moeda)
}
