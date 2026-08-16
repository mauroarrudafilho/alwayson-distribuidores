import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUpDown, Download, Loader2, Upload, Wand2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useVendedores } from '@/hooks/useDistribuidorPerformance'
import {
  useBulkUpsertMetas,
  useHistoricoEquipe,
  useMesesComResultado,
  type MetaInput,
} from '@/hooks/useMetas'
import { useVendedorHierarchy } from '@/hooks/usePerformanceHierarchy'
import { formatCurrency } from '@/lib/format'
import { getCurrentMonth } from '@/lib/periodo'
import {
  formatValorInput,
  historicoSubarvore,
  limitesDoMes,
  mesmoMesAnoAnterior,
  normalizarValorMetaInput,
  parseValorMeta,
  splitProporcional,
} from '@/lib/metasProporcao'
import { parseMetasCsv, parseMetasXlsx, type MetaUploadRow } from '@/lib/parseMetasUpload'
import type { Meta } from '@/types/distribuidor'
import { cn } from '@/lib/utils'

const TIPOS: { value: Meta['tipo']; label: string; moeda: boolean }[] = [
  { value: 'faturamento', label: 'Faturamento', moeda: true },
  { value: 'positivacao', label: 'Positivação', moeda: false },
  { value: 'mix', label: 'Mix (SKUs)', moeda: false },
  { value: 'clientes_estrategicos', label: 'Clientes Estratégicos', moeda: false },
]

const templateHref = `${import.meta.env.BASE_URL}templates/template-metas.xlsx`.replace(/\/+/g, '/')

function formatMesReferencia(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

function mesReferenciaDefault(mesMeta: string, meses: { mes: string }[]): string | null {
  if (meses.length === 0) return null
  const preferido = mesmoMesAnoAnterior(mesMeta)
  if (meses.some((m) => m.mes === preferido)) return preferido
  return meses[0].mes
}

type Modo = 'topdown' | 'importar'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  distribuidorId?: string
  mesDefault?: string
}

function formatHistorico(v: number, moeda: boolean) {
  return moeda ? formatCurrency(v) : v.toLocaleString('pt-BR')
}

function MetaGridSection({
  titulo,
  subtitulo,
  linhas,
  moeda,
  onChange,
  somaPai,
}: {
  titulo: string
  subtitulo?: string
  linhas: Array<{
    id: string
    nome: string
    metaSug: number | null
    pctHist?: number | null
    valor: string
  }>
  moeda: boolean
  onChange: (id: string, valor: string) => void
  somaPai?: number | null
}) {
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const linhasOrdenadas = useMemo(() => {
    return [...linhas].sort((a, b) => {
      const va = a.metaSug
      const vb = b.metaSug
      if (va === null && vb === null) return a.nome.localeCompare(b.nome, 'pt-BR')
      if (va === null) return 1
      if (vb === null) return -1
      const cmp = va - vb
      if (cmp !== 0) return sortDir === 'desc' ? -cmp : cmp
      return a.nome.localeCompare(b.nome, 'pt-BR')
    })
  }, [linhas, sortDir])

  const soma = linhas.reduce((s, l) => s + (parseValorMeta(l.valor) ?? 0), 0)
  const diff =
    somaPai != null && somaPai > 0 ? Math.round((soma - somaPai) * 100) / 100 : null

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium">{titulo}</h3>
          {subtitulo && <p className="text-[11px] text-muted-foreground">{subtitulo}</p>}
        </div>
        {linhas.length > 0 && (
          <p className="text-xs text-muted-foreground tabular-nums">
            Soma:{' '}
            <span className="font-medium text-foreground">
              {moeda ? formatCurrency(soma) : soma.toLocaleString('pt-BR')}
            </span>
            {diff !== null && diff !== 0 && (
              <span className={cn('ml-2', diff > 0 ? 'text-warning' : 'text-red-600')}>
                ({diff > 0 ? '+' : ''}
                {moeda ? formatCurrency(diff) : diff} vs pai)
              </span>
            )}
          </p>
        )}
      </div>

      {linhas.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">Nenhum cadastro neste nível.</p>
      ) : (
        <div className="max-h-48 overflow-auto rounded-md border">
          <table className="w-full table-fixed caption-bottom text-sm">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[38%] px-2">Nome</TableHead>
                <TableHead className="w-[26%] px-2 text-right">
                  <button
                    type="button"
                    className="inline-flex items-center gap-0.5 text-muted-foreground transition-colors hover:text-foreground"
                    onClick={() => setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))}
                  >
                    Meta sug.
                    <ArrowUpDown className="h-3 w-3 shrink-0 opacity-60" />
                  </button>
                </TableHead>
                <TableHead className="w-[12%] px-2 text-right">% hist.</TableHead>
                <TableHead className="w-[24%] px-2 text-right">Meta</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhasOrdenadas.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="truncate px-2 py-1.5 text-xs">{l.nome}</TableCell>
                  <TableCell className="px-2 py-1.5 text-right text-xs tabular-nums text-muted-foreground">
                    {l.metaSug != null ? formatHistorico(l.metaSug, moeda) : '—'}
                  </TableCell>
                  <TableCell className="px-2 py-1.5 text-right text-xs tabular-nums text-muted-foreground">
                    {l.pctHist != null ? `${l.pctHist.toFixed(1)}%` : '—'}
                  </TableCell>
                  <TableCell className="px-2 py-1.5 text-right">
                    <Input
                      inputMode="decimal"
                      value={l.valor}
                      onChange={(e) =>
                        onChange(l.id, normalizarValorMetaInput(e.target.value, moeda))
                      }
                      className="ml-auto h-8 w-[7.25rem] text-right text-xs tabular-nums"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </table>
        </div>
      )}
    </section>
  )
}

export function MetaCadastroFlow({
  open,
  onOpenChange,
  distribuidorId,
  mesDefault,
}: Props) {
  const [modo, setModo] = useState<Modo>('topdown')
  const [mes, setMes] = useState(mesDefault ?? getCurrentMonth())
  const [tipo, setTipo] = useState<Meta['tipo']>('faturamento')
  const [metaDistribuidor, setMetaDistribuidor] = useState('')
  const [valoresGerente, setValoresGerente] = useState<Record<string, string>>({})
  const [valoresSupervisor, setValoresSupervisor] = useState<Record<string, string>>({})
  const [valoresVendedor, setValoresVendedor] = useState<Record<string, string>>({})
  const [erro, setErro] = useState<string | null>(null)
  const [refDialogOpen, setRefDialogOpen] = useState(false)
  const [mesReferenciaHist, setMesReferenciaHist] = useState<string | null>(null)
  const [mesRefPendente, setMesRefPendente] = useState<string | null>(null)
  const [mesRefEscolhido, setMesRefEscolhido] = useState<string | null>(null)

  const fileRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [previewImport, setPreviewImport] = useState<MetaUploadRow[]>([])

  const { data: vendedores } = useVendedores(distribuidorId)
  const { data: hierarchy } = useVendedorHierarchy(distribuidorId)
  const suportaHistorico = tipo !== 'mix' && tipo !== 'clientes_estrategicos'
  const { data: mesesComResultado, isLoading: loadingMeses } = useMesesComResultado({
    distribuidorId,
    tipo,
    enabled: open && modo === 'topdown' && suportaHistorico && refDialogOpen,
  })
  const { data: historicoDireto, isFetching: fetchingHist } = useHistoricoEquipe({
    distribuidorId,
    mesReferencia: mesReferenciaHist ?? undefined,
    tipo,
    enabled: open && modo === 'topdown' && suportaHistorico && !!mesReferenciaHist,
  })
  const bulk = useBulkUpsertMetas()

  const moeda = TIPOS.find((t) => t.value === tipo)?.moeda ?? true
  const periodo = useMemo(() => limitesDoMes(mes), [mes])

  const gerentes = hierarchy?.gerentes ?? []
  const supervisores = hierarchy?.supervisores ?? []
  const vendedoresOnly = hierarchy?.vendedoresOnly ?? []
  const todosVendedores = hierarchy?.vendedores ?? vendedores ?? []

  useEffect(() => {
    if (!open) return
    setMes(mesDefault ?? getCurrentMonth())
    setErro(null)
    setPreviewImport([])
    setFileName(null)
    setRefDialogOpen(false)
    setMesReferenciaHist(null)
    setMesRefPendente(null)
    setMesRefEscolhido(null)
  }, [open, mesDefault])

  useEffect(() => {
    if (!refDialogOpen || !mesesComResultado?.length) return
    setMesRefEscolhido((atual) => {
      if (atual && mesesComResultado.some((m) => m.mes === atual)) return atual
      if (mesReferenciaHist && mesesComResultado.some((m) => m.mes === mesReferenciaHist)) {
        return mesReferenciaHist
      }
      return mesReferenciaDefault(mes, mesesComResultado)
    })
  }, [refDialogOpen, mesesComResultado, mesReferenciaHist, mes])

  const aplicarSugestaoHistorico = useCallback(
    (hist: Map<string, number>) => {
      const total = parseValorMeta(metaDistribuidor)
      if (!total || gerentes.length === 0) return

      const histGerentes = gerentes.map((g) => ({
        id: g.id,
        historico: historicoSubarvore(g.id, todosVendedores, hist),
      }))
      const metasGerente = splitProporcional(total, histGerentes)
      const nextGerente: Record<string, string> = {}
      metasGerente.forEach((v, id) => {
        nextGerente[id] = formatValorInput(v, moeda)
      })
      setValoresGerente(nextGerente)

      const nextSupervisor: Record<string, string> = {}
      for (const g of gerentes) {
        const metaG = metasGerente.get(g.id) ?? 0
        const filhos = supervisores.filter((s) => s.supervisor_id === g.id)
        const histFilhos = filhos.map((s) => ({
          id: s.id,
          historico: historicoSubarvore(s.id, todosVendedores, hist),
        }))
        const metasS = splitProporcional(metaG, histFilhos)
        metasS.forEach((v, id) => {
          nextSupervisor[id] = formatValorInput(v, moeda)
        })
      }
      setValoresSupervisor(nextSupervisor)

      const nextVendedor: Record<string, string> = {}
      for (const s of supervisores) {
        const metaS = parseValorMeta(nextSupervisor[s.id] ?? '') ?? 0
        const filhos = vendedoresOnly.filter((v) => v.supervisor_id === s.id)
        const histFilhos = filhos.map((v) => ({
          id: v.id,
          historico: hist.get(v.id) ?? 0,
        }))
        const metasV = splitProporcional(metaS, histFilhos)
        metasV.forEach((v, id) => {
          nextVendedor[id] = formatValorInput(v, moeda)
        })
      }
      setValoresVendedor(nextVendedor)
    },
    [metaDistribuidor, gerentes, supervisores, vendedoresOnly, todosVendedores, moeda]
  )

  useEffect(() => {
    if (
      !mesRefPendente ||
      mesReferenciaHist !== mesRefPendente ||
      fetchingHist ||
      historicoDireto === undefined
    ) {
      return
    }
    aplicarSugestaoHistorico(historicoDireto)
    setMesRefPendente(null)
    setRefDialogOpen(false)
  }, [
    mesRefPendente,
    mesReferenciaHist,
    fetchingHist,
    historicoDireto,
    aplicarSugestaoHistorico,
  ])

  const historicoDistribuidor = useMemo(() => {
    if (!historicoDireto) return 0
    let sum = 0
    historicoDireto.forEach((v) => {
      sum += v
    })
    return sum
  }, [historicoDireto])

  function abrirDialogReferencia() {
    if (!parseValorMeta(metaDistribuidor)) return
    setRefDialogOpen(true)
  }

  function confirmarMesReferencia() {
    if (!mesRefEscolhido) return
    setMesReferenciaHist(mesRefEscolhido)
    setMesRefPendente(mesRefEscolhido)
  }

  const metasSugeridas = useMemo(() => {
    const out = {
      gerente: new Map<string, number>(),
      supervisor: new Map<string, number>(),
      vendedor: new Map<string, number>(),
    }
    const total = parseValorMeta(metaDistribuidor)
    const hist = historicoDireto
    if (!total || !hist || gerentes.length === 0) return out

    const histGerentes = gerentes.map((g) => ({
      id: g.id,
      historico: historicoSubarvore(g.id, todosVendedores, hist),
    }))
    const metasGerente = splitProporcional(total, histGerentes)
    metasGerente.forEach((v, id) => out.gerente.set(id, v))

    for (const g of gerentes) {
      const metaG = metasGerente.get(g.id) ?? 0
      const filhos = supervisores.filter((s) => s.supervisor_id === g.id)
      const histFilhos = filhos.map((s) => ({
        id: s.id,
        historico: historicoSubarvore(s.id, todosVendedores, hist),
      }))
      splitProporcional(metaG, histFilhos).forEach((v, id) => out.supervisor.set(id, v))
    }

    for (const s of supervisores) {
      const metaS = out.supervisor.get(s.id) ?? 0
      const filhos = vendedoresOnly.filter((v) => v.supervisor_id === s.id)
      const histFilhos = filhos.map((v) => ({
        id: v.id,
        historico: hist.get(v.id) ?? 0,
      }))
      splitProporcional(metaS, histFilhos).forEach((v, id) => out.vendedor.set(id, v))
    }

    return out
  }, [
    metaDistribuidor,
    historicoDireto,
    gerentes,
    supervisores,
    vendedoresOnly,
    todosVendedores,
  ])

  const linhasGerente = useMemo(() => {
    const somaHist = gerentes.reduce(
      (s, g) => s + historicoSubarvore(g.id, todosVendedores, historicoDireto ?? new Map()),
      0
    )
    return gerentes.map((g) => {
      const hist = historicoSubarvore(g.id, todosVendedores, historicoDireto ?? new Map())
      return {
        id: g.id,
        nome: g.nome,
        metaSug: metasSugeridas.gerente.get(g.id) ?? null,
        pctHist: somaHist > 0 ? (hist / somaHist) * 100 : null,
        valor: valoresGerente[g.id] ?? '',
      }
    })
  }, [gerentes, todosVendedores, historicoDireto, valoresGerente, metasSugeridas])

  const linhasSupervisor = useMemo(() => {
    return supervisores.map((s) => {
      const gerente = gerentes.find((g) => g.id === s.supervisor_id)
      const hist = historicoSubarvore(s.id, todosVendedores, historicoDireto ?? new Map())
      const irmaos = supervisores.filter((x) => x.supervisor_id === s.supervisor_id)
      const somaHist = irmaos.reduce(
        (acc, x) => acc + historicoSubarvore(x.id, todosVendedores, historicoDireto ?? new Map()),
        0
      )
      return {
        id: s.id,
        nome: gerente ? `${s.nome} · ${gerente.nome}` : s.nome,
        metaSug: metasSugeridas.supervisor.get(s.id) ?? null,
        pctHist: somaHist > 0 ? (hist / somaHist) * 100 : null,
        valor: valoresSupervisor[s.id] ?? '',
      }
    })
  }, [supervisores, gerentes, todosVendedores, historicoDireto, valoresSupervisor, metasSugeridas])

  const linhasVendedor = useMemo(() => {
    return vendedoresOnly.map((v) => {
      const sup = supervisores.find((s) => s.id === v.supervisor_id)
      const hist = historicoDireto?.get(v.id) ?? 0
      const irmaos = vendedoresOnly.filter((x) => x.supervisor_id === v.supervisor_id)
      const somaHist = irmaos.reduce((acc, x) => acc + (historicoDireto?.get(x.id) ?? 0), 0)
      return {
        id: v.id,
        nome: sup ? `${v.nome} · ${sup.nome}` : v.nome,
        metaSug: metasSugeridas.vendedor.get(v.id) ?? null,
        pctHist: somaHist > 0 ? (hist / somaHist) * 100 : null,
        valor: valoresVendedor[v.id] ?? '',
      }
    })
  }, [vendedoresOnly, supervisores, historicoDireto, valoresVendedor, metasSugeridas])

  function montarPayloadsTopDown(): MetaInput[] {
    if (!distribuidorId) return []
    const payloads: MetaInput[] = []

    const distVal = parseValorMeta(metaDistribuidor)
    if (distVal) {
      payloads.push({
        distribuidor_id: distribuidorId,
        vendedor_id: null,
        hierarquia: 'distribuidor',
        tipo,
        periodo_inicio: periodo.inicio,
        periodo_fim: periodo.fim,
        valor_meta: distVal,
        observacao: null,
      })
    }

    for (const g of gerentes) {
      const v = parseValorMeta(valoresGerente[g.id] ?? '')
      if (!v) continue
      payloads.push({
        distribuidor_id: distribuidorId,
        vendedor_id: g.id,
        hierarquia: 'gerente',
        tipo,
        periodo_inicio: periodo.inicio,
        periodo_fim: periodo.fim,
        valor_meta: v,
        observacao: null,
      })
    }

    for (const s of supervisores) {
      const v = parseValorMeta(valoresSupervisor[s.id] ?? '')
      if (!v) continue
      payloads.push({
        distribuidor_id: distribuidorId,
        vendedor_id: s.id,
        hierarquia: 'supervisor',
        tipo,
        periodo_inicio: periodo.inicio,
        periodo_fim: periodo.fim,
        valor_meta: v,
        observacao: null,
      })
    }

    for (const vendedor of vendedoresOnly) {
      const v = parseValorMeta(valoresVendedor[vendedor.id] ?? '')
      if (!v) continue
      payloads.push({
        distribuidor_id: distribuidorId,
        vendedor_id: vendedor.id,
        hierarquia: 'vendedor',
        tipo,
        periodo_inicio: periodo.inicio,
        periodo_fim: periodo.fim,
        valor_meta: v,
        observacao: null,
      })
    }

    return payloads
  }

  function resolverVendedor(row: MetaUploadRow) {
    if (row.hierarquia === 'distribuidor') return null
    const lista = todosVendedores.filter((v) => v.tipo === row.hierarquia)
    const normNome = (s: string) =>
      s.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    if (row.codigo_externo) {
      const cod = row.codigo_externo.trim()
      const hit = lista.find((v) => String(v.codigo_externo ?? '').trim() === cod)
      if (hit) return hit.id
    }
    if (row.responsavel) {
      const norm = normNome(row.responsavel)
      const hit = lista.find((v) => normNome(v.nome) === norm)
      if (hit) return hit.id
    }
    return undefined
  }

  function montarPayloadsImport(): MetaInput[] {
    if (!distribuidorId) return []
    return previewImport.map((row) => {
      const { inicio, fim } = limitesDoMes(row.periodo)
      const vendedorId = resolverVendedor(row)
      if (row.hierarquia !== 'distribuidor' && vendedorId === undefined) {
        throw new Error(
          `Linha não encontrada: ${row.hierarquia} ${row.codigo_externo ?? row.responsavel ?? '?'}`
        )
      }
      return {
        distribuidor_id: distribuidorId,
        vendedor_id: vendedorId ?? null,
        hierarquia: row.hierarquia,
        tipo: row.tipo,
        periodo_inicio: inicio,
        periodo_fim: fim,
        valor_meta: row.valor_meta,
        observacao: null,
      }
    })
  }

  async function onFile(file: File | null) {
    setErro(null)
    setPreviewImport([])
    if (!file) {
      setFileName(null)
      return
    }
    setFileName(file.name)
    try {
      const lower = file.name.toLowerCase()
      let rows: MetaUploadRow[]
      if (lower.endsWith('.csv')) {
        rows = parseMetasCsv(await file.text())
      } else if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
        rows = parseMetasXlsx(await file.arrayBuffer())
      } else {
        setErro('Use .csv, .xlsx ou .xls')
        return
      }
      if (rows.length === 0) {
        setErro('Nenhuma linha válida. Confira o template.')
        return
      }
      setPreviewImport(rows)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao ler arquivo')
    }
  }

  async function handleGravar() {
    setErro(null)
    if (!distribuidorId) {
      setErro('Selecione um distribuidor.')
      return
    }
    try {
      const payloads = modo === 'topdown' ? montarPayloadsTopDown() : montarPayloadsImport()
      if (payloads.length === 0) {
        setErro('Informe ao menos uma meta.')
        return
      }
      await bulk.mutateAsync(payloads)
      onOpenChange(false)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao gravar metas.')
    }
  }

  const totalPayload = modo === 'topdown' ? montarPayloadsTopDown().length : previewImport.length

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(92vh,900px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b px-4 py-3">
          <DialogTitle>Definir metas</DialogTitle>
          <DialogDescription>
            Top-down com sugestão por histórico ou importação em lote via planilha.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={modo}
          onValueChange={(v) => setModo(v as Modo)}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="border-b px-4 pt-2.5">
            <TabsList variant="line" className="h-auto gap-4 border-0 bg-transparent p-0">
              <TabsTrigger
                value="topdown"
                className="rounded-none border-b-2 border-transparent px-0 pb-2 data-active:border-teal"
              >
                Top-down
              </TabsTrigger>
              <TabsTrigger
                value="importar"
                className="rounded-none border-b-2 border-transparent px-0 pb-2 data-active:border-teal"
              >
                Importar planilha
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 pb-4">
            <TabsContent value="topdown" className="mt-0 space-y-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1.5 w-[9.5rem]">
                  <label className="text-xs font-medium">Mês</label>
                  <Input
                    type="month"
                    value={mes}
                    onChange={(e) => setMes(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5 min-w-[10rem] flex-1 max-w-xs">
                  <label className="text-xs font-medium">Métrica</label>
                  <Select
                    value={tipo}
                    onValueChange={(v) => {
                      const next = v as Meta['tipo']
                      const nextMoeda = TIPOS.find((t) => t.value === next)?.moeda ?? true
                      setTipo(next)
                      setMesReferenciaHist(null)
                      setMesRefPendente(null)
                      setMesRefEscolhido(null)
                      const parsed = parseValorMeta(metaDistribuidor)
                      if (parsed != null) {
                        setMetaDistribuidor(formatValorInput(parsed, nextMoeda))
                      }
                      setValoresGerente((prev) =>
                        Object.fromEntries(
                          Object.entries(prev).map(([id, val]) => {
                            const n = parseValorMeta(val)
                            return [id, n != null ? formatValorInput(n, nextMoeda) : val]
                          })
                        )
                      )
                      setValoresSupervisor((prev) =>
                        Object.fromEntries(
                          Object.entries(prev).map(([id, val]) => {
                            const n = parseValorMeta(val)
                            return [id, n != null ? formatValorInput(n, nextMoeda) : val]
                          })
                        )
                      )
                      setValoresVendedor((prev) =>
                        Object.fromEntries(
                          Object.entries(prev).map(([id, val]) => {
                            const n = parseValorMeta(val)
                            return [id, n != null ? formatValorInput(n, nextMoeda) : val]
                          })
                        )
                      )
                    }}
                  >
                    <SelectTrigger className="h-9 text-sm">
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
              </div>

              <section className="rounded-lg border bg-muted/20 p-3 space-y-2.5">
                <div className="flex flex-wrap items-end gap-2">
                  <div className="space-y-1.5 w-full max-w-[11rem]">
                    <label className="text-xs font-medium">
                      Meta do distribuidor {moeda ? '(R$)' : '(qtd.)'}
                    </label>
                    <Input
                      inputMode="decimal"
                      value={metaDistribuidor}
                      onChange={(e) =>
                        setMetaDistribuidor(normalizarValorMetaInput(e.target.value, moeda))
                      }
                      className="h-9 text-sm tabular-nums"
                      placeholder={moeda ? 'R$ 500.000' : '120'}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="h-9 shrink-0"
                    disabled={!suportaHistorico || !parseValorMeta(metaDistribuidor)}
                    onClick={abrirDialogReferencia}
                  >
                    <Wand2 className="mr-1.5 h-3.5 w-3.5" />
                    Sugerir por histórico
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {mesReferenciaHist ? (
                    <>
                      Referência:{' '}
                      <span className="font-medium text-foreground">
                        {formatMesReferencia(mesReferenciaHist)}
                      </span>
                      {historicoDistribuidor > 0 && (
                        <>
                          {' '}
                          · total no mês:{' '}
                          <span className="font-medium text-foreground">
                            {formatHistorico(historicoDistribuidor, moeda)}
                          </span>
                        </>
                      )}
                    </>
                  ) : (
                    <>Informe a meta do distribuidor e escolha um mês de referência com sell-out.</>
                  )}
                  {!suportaHistorico && (
                    <> Proporcional automático disponível só para faturamento e positivação.</>
                  )}
                </p>
              </section>

              <MetaGridSection
                titulo="Gerentes"
                subtitulo="Ajuste a sugestão antes de descer para supervisão"
                linhas={linhasGerente}
                moeda={moeda}
                somaPai={parseValorMeta(metaDistribuidor)}
                onChange={(id, v) => setValoresGerente((prev) => ({ ...prev, [id]: v }))}
              />

              <MetaGridSection
                titulo="Supervisores"
                linhas={linhasSupervisor}
                moeda={moeda}
                onChange={(id, v) => setValoresSupervisor((prev) => ({ ...prev, [id]: v }))}
              />

              <MetaGridSection
                titulo="Vendedores"
                linhas={linhasVendedor}
                moeda={moeda}
                onChange={(id, v) => setValoresVendedor((prev) => ({ ...prev, [id]: v }))}
              />
            </TabsContent>

            <TabsContent value="importar" className="mt-0 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <a href={templateHref} download className="inline-flex">
                  <Button type="button" variant="outline" size="sm" className="h-8 text-xs">
                    <Download className="mr-1.5 h-3.5 w-3.5" />
                    Baixar template
                  </Button>
                </a>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload className="mr-1.5 h-3.5 w-3.5" />
                  Selecionar arquivo
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
                />
                {fileName && (
                  <span className="self-center text-xs text-muted-foreground">{fileName}</span>
                )}
              </div>

              <p className="text-[11px] text-muted-foreground">
                Colunas da planilha: hierarquia, codigo_externo (ou responsavel), tipo,
                periodo (YYYY-MM), valor_meta. Baixe o template para o layout esperado.
              </p>

              {previewImport.length > 0 && (
                <div className="max-h-64 overflow-auto rounded-md border">
                  <table className="w-full table-fixed caption-bottom text-sm">
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-[18%] px-2">Hierarquia</TableHead>
                        <TableHead className="w-[32%] px-2">Código / Nome</TableHead>
                        <TableHead className="w-[18%] px-2">Tipo</TableHead>
                        <TableHead className="w-[14%] px-2">Período</TableHead>
                        <TableHead className="w-[18%] px-2 text-right">Meta</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewImport.slice(0, 100).map((r, i) => (
                        <TableRow key={i}>
                          <TableCell className="px-2 py-1.5 text-xs">{r.hierarquia}</TableCell>
                          <TableCell className="truncate px-2 py-1.5 text-xs">
                            {r.codigo_externo ?? r.responsavel ?? '—'}
                          </TableCell>
                          <TableCell className="px-2 py-1.5 text-xs">{r.tipo}</TableCell>
                          <TableCell className="px-2 py-1.5 text-xs tabular-nums">{r.periodo}</TableCell>
                          <TableCell className="px-2 py-1.5 text-right text-xs tabular-nums">
                            {r.tipo === 'faturamento'
                              ? formatCurrency(r.valor_meta)
                              : r.valor_meta.toLocaleString('pt-BR')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </table>
                </div>
              )}
              {previewImport.length > 100 && (
                <p className="text-xs text-muted-foreground">
                  Mostrando 100 de {previewImport.length} linhas.
                </p>
              )}
            </TabsContent>

            {erro && <p className="text-xs text-destructive">{erro}</p>}
          </div>
        </Tabs>

        <DialogFooter className="mx-0 mb-0 flex shrink-0 flex-row justify-end gap-2 rounded-b-xl border-t bg-muted/30 px-4 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={bulk.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleGravar} disabled={bulk.isPending || totalPayload === 0}>
            {bulk.isPending ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Gravando…
              </>
            ) : (
              `Gravar ${totalPayload} meta(s)`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={refDialogOpen} onOpenChange={setRefDialogOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mês de referência</DialogTitle>
          <DialogDescription>
            Escolha um mês com sell-out registrado. As metas serão distribuídas na mesma
            proporcionalidade daquele período.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-72 overflow-y-auto rounded-md border">
          {loadingMeses ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando meses…
            </div>
          ) : mesesComResultado?.length ? (
            <ul className="divide-y">
              {mesesComResultado.map((m) => {
                const selecionado = mesRefEscolhido === m.mes
                return (
                  <li key={m.mes}>
                    <button
                      type="button"
                      className={cn(
                        'flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/60',
                        selecionado && 'bg-teal/10'
                      )}
                      onClick={() => setMesRefEscolhido(m.mes)}
                    >
                      <span className={cn('font-medium', selecionado && 'text-teal')}>
                        {formatMesReferencia(m.mes)}
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {moeda ? formatCurrency(m.total) : m.total.toLocaleString('pt-BR')}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="px-3 py-10 text-center text-sm text-muted-foreground">
              Nenhum mês com resultado para este distribuidor.
            </p>
          )}
        </div>

        <DialogFooter className="mx-0 mb-0 flex flex-row justify-end gap-2">
          <Button variant="outline" onClick={() => setRefDialogOpen(false)}>
            Cancelar
          </Button>
          <Button
            onClick={confirmarMesReferencia}
            disabled={
              !mesRefEscolhido ||
              !mesesComResultado?.length ||
              (mesRefPendente === mesRefEscolhido && fetchingHist)
            }
          >
            {mesRefPendente === mesRefEscolhido && fetchingHist ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Calculando…
              </>
            ) : (
              'Aplicar proporção'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  )
}
