import { useMemo, useState } from 'react'
import { CalendarRange } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useMetasPanorama } from '@/hooks/useMetas'
import { getCurrentMonth } from '@/lib/periodo'
import type { Meta } from '@/types/distribuidor'

const HIERARQUIAS: { value: Meta['hierarquia']; label: string }[] = [
  { value: 'vendedor', label: 'Vendedor' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'gerente', label: 'Gerente' },
  { value: 'distribuidor', label: 'Distribuidor' },
]

const TIPOS: { value: Meta['tipo']; label: string }[] = [
  { value: 'faturamento', label: 'Faturamento' },
  { value: 'positivacao', label: 'Positivação' },
  { value: 'mix', label: 'Mix' },
  { value: 'clientes_excelencia', label: 'Clientes Excelência' },
]

/** Lista de meses YYYY-MM de início a fim, inclusive. */
function mesesEntre(inicio: string, fim: string): string[] {
  const out: string[] = []
  const [ai, mi] = inicio.split('-').map(Number)
  const [af, mf] = fim.split('-').map(Number)
  if (!ai || !mi || !af || !mf) return out
  let ano = ai
  let mes = mi
  // Teto de 24 colunas: além disso a grade deixa de ser legível.
  while ((ano < af || (ano === af && mes <= mf)) && out.length < 24) {
    out.push(`${ano}-${String(mes).padStart(2, '0')}`)
    mes += 1
    if (mes > 12) {
      mes = 1
      ano += 1
    }
  }
  return out
}

function rotuloMes(ym: string): string {
  const [ano, mes] = ym.split('-')
  const nomes = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  return `${nomes[Number(mes) - 1] ?? mes}/${ano.slice(2)}`
}

function corAtingimento(p: number | null): string {
  if (p === null) return 'text-muted-foreground'
  if (p >= 100) return 'text-emerald-600'
  if (p >= 80) return 'text-amber-600'
  return 'text-red-600'
}

/** Mês corrente menos N meses. */
function mesMenos(n: number): string {
  const [ano, mes] = getCurrentMonth().split('-').map(Number)
  const d = new Date(ano, mes - 1 - n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function MetasPanorama({ distribuidorId }: { distribuidorId?: string }) {
  const [hierarquia, setHierarquia] = useState<Meta['hierarquia']>('vendedor')
  const [tipo, setTipo] = useState<Meta['tipo']>('faturamento')
  const [mesInicio, setMesInicio] = useState(mesMenos(5))
  const [mesFim, setMesFim] = useState(getCurrentMonth())

  const { data, isLoading } = useMetasPanorama({
    distribuidorId,
    hierarquia,
    tipo,
    mesInicio,
    mesFim,
  })

  const meses = useMemo(() => mesesEntre(mesInicio, mesFim), [mesInicio, mesFim])

  /** Uma linha por responsável, com a célula de cada mês. */
  const linhas = useMemo(() => {
    const porResponsavel = new Map<
      string,
      { nome: string; celulas: Map<string, { meta: number; pct: number | null }> }
    >()

    for (const m of data ?? []) {
      const chave = m.vendedor_id ?? '__distribuidor__'
      const nome = m.vendedor_nome ?? m.distribuidor_nome
      if (!porResponsavel.has(chave)) {
        porResponsavel.set(chave, { nome, celulas: new Map() })
      }
      porResponsavel.get(chave)!.celulas.set(m.periodo_inicio.slice(0, 7), {
        meta: Number(m.valor_meta),
        pct: m.percentual_atingimento === null ? null : Number(m.percentual_atingimento),
      })
    }

    return [...porResponsavel.values()]
      .map((r) => {
        // Acumulado: soma das metas × soma dos realizados implícitos no período,
        // não a média dos percentuais — média de percentual distorce quando as
        // metas mensais têm tamanhos diferentes.
        let somaMeta = 0
        let somaRealizado = 0
        for (const c of r.celulas.values()) {
          if (c.pct === null) continue
          somaMeta += c.meta
          somaRealizado += (c.meta * c.pct) / 100
        }
        return {
          ...r,
          acumulado: somaMeta > 0 ? (somaRealizado / somaMeta) * 100 : null,
        }
      })
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [data])

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <h3 className="text-sm font-medium text-foreground flex items-center gap-2 mr-auto">
            <CalendarRange className="w-4 h-4" />
            Panorama mês a mês
          </h3>

          <div className="space-y-1">
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Nível
            </label>
            <Select
              value={hierarquia}
              onValueChange={(v) => setHierarquia((v ?? 'vendedor') as Meta['hierarquia'])}
            >
              <SelectTrigger className="h-8 w-36 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HIERARQUIAS.map((h) => (
                  <SelectItem key={h.value} value={h.value}>
                    {h.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Métrica
            </label>
            <Select value={tipo} onValueChange={(v) => setTipo((v ?? 'faturamento') as Meta['tipo'])}>
              <SelectTrigger className="h-8 w-40 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground">De</label>
            <Input
              type="month"
              value={mesInicio}
              onChange={(e) => setMesInicio(e.target.value)}
              className="h-8 w-32 text-xs"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Até</label>
            <Input
              type="month"
              value={mesFim}
              onChange={(e) => setMesFim(e.target.value)}
              className="h-8 w-32 text-xs"
            />
          </div>
        </div>

        {!distribuidorId ? (
          <p className="text-xs text-muted-foreground py-6 text-center">
            Selecione um distribuidor para ver o panorama.
          </p>
        ) : isLoading ? (
          <p className="text-xs text-muted-foreground py-6 text-center">Carregando…</p>
        ) : linhas.length === 0 ? (
          <p className="text-xs text-muted-foreground py-6 text-center">
            Nenhuma meta de {TIPOS.find((t) => t.value === tipo)?.label.toLowerCase()} neste nível
            e período.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="text-left font-medium py-2 pr-3 sticky left-0 bg-card">
                    Responsável
                  </th>
                  {meses.map((m) => (
                    <th key={m} className="text-right font-medium py-2 px-2 whitespace-nowrap">
                      {rotuloMes(m)}
                    </th>
                  ))}
                  <th className="text-right font-medium py-2 pl-3 border-l">Acum.</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.nome} className="border-b last:border-0">
                    <td className="py-1.5 pr-3 truncate max-w-[220px] sticky left-0 bg-card">
                      {l.nome}
                    </td>
                    {meses.map((m) => {
                      const c = l.celulas.get(m)
                      return (
                        <td
                          key={m}
                          className={`py-1.5 px-2 text-right tabular-nums ${corAtingimento(
                            c?.pct ?? null,
                          )}`}
                        >
                          {c ? (c.pct === null ? '—' : `${c.pct.toFixed(0)}%`) : ''}
                        </td>
                      )
                    })}
                    <td
                      className={`py-1.5 pl-3 text-right tabular-nums font-medium border-l ${corAtingimento(
                        l.acumulado,
                      )}`}
                    >
                      {l.acumulado === null ? '—' : `${l.acumulado.toFixed(0)}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-[11px] text-muted-foreground">
          Célula vazia = sem meta definida naquele mês. <span className="mx-1">·</span>
          O acumulado pondera pelo tamanho das metas, não é média dos percentuais.
        </p>
      </CardContent>
    </Card>
  )
}
