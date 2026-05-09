import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Trash2,
  CheckCircle2,
  Circle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  MoreVertical,
} from 'lucide-react'
import { PageHeader } from '@/components/distribuidor/PageHeader'
import { FilterField } from '@/components/distribuidor/FilterBar'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useAuth } from '@/contexts/auth'
import { supabase } from '@/lib/supabase'
import { parseInsightsCnpj } from '@/lib/insightsCnpj'
import { insightsCnpjKey } from '@/hooks/useInsightsQueries'
import {
  insightsClienteBrasilStatusTitle,
  parseInsightsClienteBrasilStatus,
} from '@/lib/insightsClienteBrasilStatus'
import { cn } from '@/lib/utils'
import type { InsightsClienteBrasilStatus } from '@/types/insights'

type InsightClienteDim = {
  cnpj_14: string
  nome_cliente: string | null
  razao_social: string | null
  cidade: string | null
  estado: string | null
  brasil_enriquecimento_status: string | null
  cadastro_ativo: boolean | null
  brasil_api_ultimo_motivo: string | null
}

type CadastroCheck = {
  id: string
  label: string
  ok: boolean
  /** Quando não ok, texto curto para tooltip */
  detalhe?: string
}

function formatCnpjDisplay(d14: string) {
  const d = d14.replace(/\D/g, '').padStart(14, '0').slice(-14)
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`
}

function montarChecksCadastroInsights(r: InsightClienteDim): CadastroCheck[] {
  const nomeOk = Boolean(
    (r.nome_cliente ?? '').trim() || (r.razao_social ?? '').trim()
  )
  const localOk =
    Boolean((r.cidade ?? '').trim()) && Boolean((r.estado ?? '').trim())

  const st = parseInsightsClienteBrasilStatus(r.brasil_enriquecimento_status)
  const apiOk = st === 'ready'
  const apiPendente = st === 'pending' || st === 'processing'

  const falhaMotivo =
    st === 'error' || st === 'not_found'
      ? [insightsClienteBrasilStatusTitle(st), r.brasil_api_ultimo_motivo].filter(Boolean).join(' — ')
      : ''

  const ativaOk = apiOk && r.cadastro_ativo !== false

  const checks: CadastroCheck[] = [
    {
      id: 'nome',
      label: 'Identificação (nome)',
      ok: nomeOk,
      detalhe: nomeOk ? undefined : 'Inclua nome ou razão na origem / import',
    },
    {
      id: 'local',
      label: 'Cidade / UF',
      ok: localOk,
      detalhe: localOk ? undefined : 'Preenchido após BrasilAPI ou planilha',
    },
    {
      id: 'brasil',
      label: 'Consulta Receita (BrasilAPI)',
      ok: apiOk,
      detalhe: apiOk
        ? undefined
        : apiPendente
          ? 'Na fila — rode o worker ou aguarde import'
          : st === 'error' || st === 'not_found'
            ? falhaMotivo || 'Falha na consulta'
            : 'Aguardando processamento',
    },
    {
      id: 'ativa',
      label: 'Situação ATIVA',
      ok: ativaOk,
      detalhe: ativaOk
        ? undefined
        : apiOk && r.cadastro_ativo === false
          ? 'CNPJ não ATIVO na Receita'
          : 'Aguardando consulta',
    },
  ]

  return checks
}

function percentualCadastro(checks: CadastroCheck[]) {
  if (!checks.length) return 0
  return Math.round((checks.filter((c) => c.ok).length / checks.length) * 100)
}

function resumoCadastroRow(pct: number, st: InsightsClienteBrasilStatus | undefined) {
  if (pct >= 100) return { label: 'Completo', variant: 'success' as const }
  if (st === 'error' || st === 'not_found')
    return { label: 'Bloqueado', variant: 'destructive' as const }
  return { label: 'Em andamento', variant: 'warning' as const }
}

const TABLE_COLS = 9

function CelulaConsultaReceita({ r }: { r: InsightClienteDim }) {
  const st = parseInsightsClienteBrasilStatus(r.brasil_enriquecimento_status)
  const hint =
    st === 'error' || st === 'not_found'
      ? [insightsClienteBrasilStatusTitle(st), r.brasil_api_ultimo_motivo].filter(Boolean).join(' — ')
      : undefined
  if (st === 'ready')
    return (
      <Badge variant="success" className="font-normal">
        OK
      </Badge>
    )
  if (st === 'pending' || st === 'processing')
    return (
      <Badge variant="info" className="font-normal">
        Fila
      </Badge>
    )
  if (st === 'error' || st === 'not_found')
    return (
      <Badge variant="destructive" className="font-normal max-w-32 truncate" title={hint}>
        Falha
      </Badge>
    )
  return (
    <Badge variant="secondary" className="font-normal">
      Pendente
    </Badge>
  )
}

function CelulaSituacaoReceita({ r }: { r: InsightClienteDim }) {
  const st = parseInsightsClienteBrasilStatus(r.brasil_enriquecimento_status)
  if (st !== 'ready')
    return <span className="text-xs text-muted-foreground">—</span>
  if (r.cadastro_ativo === false)
    return (
      <Badge variant="destructive" className="font-normal">
        Não ATIVA
      </Badge>
    )
  return (
    <Badge variant="success" className="font-normal">
      ATIVA
    </Badge>
  )
}

const FILTRO_TODAS = 'todos' as const
const PAGE_SIZE = 25

/** Rótulos do filtro «Situação na Receita» — evita mostrar o valor interno no trigger. */
const SITUACAO_NA_RECEITA_LABELS: Record<string, string> = {
  [FILTRO_TODAS]: 'Todos',
  __all__: 'Todos',
  ativa: 'ATIVA (última consulta)',
  inativa: 'Não ATIVA',
  pendente: 'Consulta pendente / processando',
  erro: 'Erro ou não encontrado',
}

function situacaoCadastroRow(r: InsightClienteDim): 'ativa' | 'inativa' | 'pendente' | 'erro' {
  const st = parseInsightsClienteBrasilStatus(r.brasil_enriquecimento_status)
  if (st === 'error' || st === 'not_found') return 'erro'
  if (st === 'ready' && r.cadastro_ativo === false) return 'inativa'
  if (st === 'ready' && r.cadastro_ativo !== false) return 'ativa'
  return 'pendente'
}

function matchSituacaoFiltro(r: InsightClienteDim, filtro: string): boolean {
  if (!filtro || filtro === FILTRO_TODAS || filtro === '__all__') return true
  return situacaoCadastroRow(r) === filtro
}

function CheckIcon({ ok, pending }: { ok: boolean; pending?: boolean }) {
  if (pending) return <Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin" />
  if (ok) return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
  return <Circle className="w-3.5 h-3.5 text-muted-foreground/60" />
}

/** Alinhado ao corpo enviado para a Edge Function (`process-insights-pendentes`). */
const REPROCESS_BATCH_LIMIT = 25

function reprocessPhaseSubtitle(elapsedSec: number): string {
  if (elapsedSec < 8) return 'A iniciar o lote e marcar CNPJs como em processamento…'
  if (elapsedSec < 28)
    return 'A consultar a BrasilAPI — uma chamada por CNPJ, com pausa para respeitar rate limits…'
  return 'A terminar consultas e gravar cidade, situação cadastral e estado na dimensão Insights…'
}

/** Destaque visual sequencial durante o tempo de espera (não há stream por CNPJ). */
function reprocessFlowHighlightIndex(elapsedSec: number): number {
  if (elapsedSec < 7) return 0
  if (elapsedSec < 42) return 1
  return 2
}

function InsightsReprocessProgressPanel(props: {
  elapsedSec: number
  pendingApprox: number
  batchLimit: number
}) {
  const { elapsedSec, pendingApprox, batchLimit } = props
  const flowIdx = reprocessFlowHighlightIndex(elapsedSec)
  const flowSteps = [
    { title: 'Pedido e reserva na base', hint: 'Edge Function marca o lote como em processamento.' },
    { title: 'Consultas Receita (BrasilAPI)', hint: 'Sequencial, com espera entre pedidos (~1–2 s por CNPJ).' },
    { title: 'Gravação dos resultados', hint: 'Cidade/UF, situação cadastral e estado da consulta por CNPJ.' },
  ] as const

  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className={cn(
        'rounded-xl border border-primary/30 bg-linear-to-br from-primary/[0.07] via-background to-muted/40',
        'p-4 sm:p-5 space-y-4 shadow-sm ring-1 ring-primary/10'
      )}
    >
      <div className="flex gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/15">
          <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-medium text-foreground text-sm">Processamento do lote em curso</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Até <strong className="text-foreground tabular-nums">{batchLimit}</strong> CNPJs em estado{' '}
            <strong className="text-foreground">pending</strong> por execução.
            {pendingApprox > 0 ? (
              <>
                {' '}
                Havia mais ou menos{' '}
                <strong className="text-foreground tabular-nums">{pendingApprox}</strong> com
                &quot;pending&quot; antes deste pedido (a lista só atualiza no fim).
              </>
            ) : null}
          </p>
        </div>
        <span className="tabular-nums shrink-0 text-xs font-medium text-muted-foreground pt-1">
          {elapsedSec}s
        </span>
      </div>

      <div className="rounded-lg border bg-background/60 px-3 py-2 text-xs text-muted-foreground transition-colors duration-300">
        {reprocessPhaseSubtitle(elapsedSec)}
      </div>

      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="absolute inset-y-0 left-0 w-[42%] rounded-full bg-primary/80 animate-insights-reprocess-indeterminate shadow-sm"
          aria-hidden
        />
      </div>
      <p className="text-[11px] text-muted-foreground">
        Tempo típico neste projeto: ~25–55 s para um lote completo. Com rate limit (429) pode estender —
        não feche o separador.
      </p>

      <div className="flex flex-wrap gap-2">
        {flowSteps.map((s, i) => {
          const active = flowIdx === i
          return (
            <div
              key={s.title}
              className={cn(
                'flex min-w-[min(100%,12rem)] flex-1 gap-2 rounded-lg border px-2.5 py-2 transition-colors duration-300',
                active
                  ? 'border-primary/40 bg-primary/12 shadow-sm'
                  : 'border-border/50 bg-muted/15 opacity-75'
              )}
            >
              <div className="pt-0.5 shrink-0" aria-hidden>
                {active ? (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground/55" />
                )}
              </div>
              <div className="min-w-0">
                <p className={cn('text-[11px] font-medium leading-snug', active && 'text-foreground')}>
                  {s.title}
                </p>
                <p className="text-[10px] text-muted-foreground leading-snug mt-0.5">{s.hint}</p>
              </div>
            </div>
          )
        })}
      </div>

      <p className="text-[10px] text-muted-foreground border-t pt-3 border-border/70">
        Não saia nem dispare novo lote até concluir: o servidor ainda está a trabalhar nos CNPJs
        selecionados.
      </p>
    </div>
  )
}

type ReprocessPendentesResult = {
  ok: boolean
  mode?: 'batch' | 'single'
  processed?: number
  skipped?: number
  failed?: number
  limit?: number
  pending_remaining?: number
  sample_errors?: string[]
  message?: string
  error?: string
  cnpj_14?: string
}

function clientePodeReconsultaBrasilApi(r: InsightClienteDim): boolean {
  const st = parseInsightsClienteBrasilStatus(r.brasil_enriquecimento_status)
  return st !== 'ready'
}

export function AdminInsightsCadastroClientes() {
  const qc = useQueryClient()
  const { isAdmin } = useAuth()
  const [busca, setBusca] = useState('')
  const [filtroCidade, setFiltroCidade] = useState<string>(FILTRO_TODAS)
  const [filtroUf, setFiltroUf] = useState<string>(FILTRO_TODAS)
  const [filtroSituacao, setFiltroSituacao] = useState<string>(FILTRO_TODAS)
  const [page, setPage] = useState(1)
  const [openCnpj, setOpenCnpj] = useState<string | null>(null)
  const [confirmacao, setConfirmacao] = useState('')
  const [reprocessMsg, setReprocessMsg] = useState<string | null>(null)
  const [reprocessElapsedSec, setReprocessElapsedSec] = useState(0)

  const list = useQuery({
    queryKey: ['admin', 'insights-clientes-cadastro', 'lista'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('alwayson_insights_clientes')
        .select(
          'cnpj_14, nome_cliente, razao_social, cidade, estado, brasil_enriquecimento_status, cadastro_ativo, brasil_api_ultimo_motivo'
        )
        .order('cnpj_14')
      if (error) throw error
      return (data ?? []) as InsightClienteDim[]
    },
  })

  const reprocessPendentes = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke<ReprocessPendentesResult>(
        'process-insights-pendentes',
        {
          body: {
            limit: REPROCESS_BATCH_LIMIT,
            use_nominatim: false,
          },
        }
      )
      if (error) throw new Error(error.message ?? 'Erro ao chamar Edge Function.')
      const payload = data
      if (!payload) throw new Error('Resposta vazia.')
      if (!payload.ok) {
        const code = payload.error ?? 'unknown'
        if (code === 'forbidden') throw new Error('Sem permissão (apenas admin global).')
        if (code === 'missing_auth') throw new Error('Sessão expirada — faça login novamente.')
        throw new Error(`Função: ${code}`)
      }
      return payload
    },
    onSuccess: async (payload) => {
      if ((payload.processed ?? 0) === 0 && payload.message) {
        setReprocessMsg(payload.message)
      } else {
        setReprocessMsg(
          `Lote: ${payload.processed ?? 0} processado(s).${payload.pending_remaining != null ? ` Restantes pending: ${payload.pending_remaining}.` : ''}${payload.failed ? ` Falhas neste lote: ${payload.failed}.` : ''}`
        )
      }
      await qc.invalidateQueries({ queryKey: ['admin', 'insights-clientes-cadastro'] })
      await qc.invalidateQueries({ queryKey: ['insights'] })
    },
    onError: (err: unknown) => {
      const raw = err instanceof Error ? err.message : String(err ?? '')
      const msg =
        raw.includes('Failed to fetch') || raw.includes('EDGE_FUNCTION_INVOCATION_FAILED')
          ? 'Edge Function indisponível ou não implantada — use o CLI ou o dashboard Supabase para publicar `process-insights-pendentes`.'
          : raw
      setReprocessMsg(msg)
    },
  })

  const reprocessUmCliente = useMutation<
    ReprocessPendentesResult,
    Error,
    string
  >({
    mutationFn: async (cnpj14: string) => {
      const { data, error } = await supabase.functions.invoke<ReprocessPendentesResult>(
        'process-insights-pendentes',
        {
          body: { cnpj_14: cnpj14, use_nominatim: false },
        }
      )
      if (error) throw new Error(error.message ?? 'Erro ao chamar Edge Function.')
      const payload = data
      if (!payload) throw new Error('Resposta vazia.')
      if (!payload.ok) {
        const code = payload.error ?? 'unknown'
        if (code === 'forbidden') throw new Error('Sem permissão (apenas admin global).')
        if (code === 'missing_auth') throw new Error('Sessão expirada — faça login novamente.')
        if (code === 'cnpj_not_found') throw new Error(payload.message ?? 'CNPJ não encontrado.')
        throw new Error(payload.message ?? `Função: ${code}`)
      }
      return payload
    },
    onSuccess: async (payload) => {
      if (payload.mode === 'single' && payload.cnpj_14) {
        const msg =
          payload.message ??
          (payload.processed === 1
            ? 'Consulta atualizada.'
            : payload.failed === 1
              ? 'Falha ao processar.'
              : undefined)
        setReprocessMsg(
          msg
            ? `${formatCnpjDisplay(payload.cnpj_14)} · ${msg}`
            : `${formatCnpjDisplay(payload.cnpj_14)} · Concluído.`,
        )
      }
      await qc.invalidateQueries({ queryKey: ['admin', 'insights-clientes-cadastro'] })
      await qc.invalidateQueries({ queryKey: ['insights'] })
    },
    onError: (err: unknown) => {
      const raw = err instanceof Error ? err.message : String(err ?? '')
      const msg =
        raw.includes('Failed to fetch') || raw.includes('EDGE_FUNCTION_INVOCATION_FAILED')
          ? 'Edge Function indisponível ou não implantada — publique `process-insights-pendentes`.'
          : raw
      setReprocessMsg(msg)
    },
  })

  const pendingCount = useMemo(
    () =>
      list.data?.filter((r) => String(r.brasil_enriquecimento_status ?? '') === 'pending').length ??
      0,
    [list.data]
  )

  useEffect(() => {
    if (!reprocessPendentes.isPending) return undefined
    setReprocessElapsedSec(0)
    const started = Date.now()
    const tick = window.setInterval(() => {
      setReprocessElapsedSec(Math.floor((Date.now() - started) / 1000))
    }, 1000)
    return () => clearInterval(tick)
  }, [reprocessPendentes.isPending])

  const purge = useMutation({
    mutationFn: async ({ cnpjNorm, confirmacao }: { cnpjNorm: string; confirmacao: string }) => {
      const { data, error } = await supabase.rpc('insights_delete_cliente_e_nfs', {
        p_cnpj_14: cnpjNorm,
        p_secret: confirmacao.trim(),
      })
      if (error) throw error
      const payload = data as { ok?: boolean; error?: string; cnpj_14?: string }
      if (!payload?.ok) {
        const code = payload?.error
        let msg = 'Falha na exclusão'
        if (code === 'forbidden') msg = 'CNPJ digitado não confere com o cliente alvo.'
        else if (code === 'nao_encontrado') msg = 'Cliente não encontrado.'
        else if (code === 'cnpj_invalido') msg = 'CNPJ inválido.'
        else if (typeof code === 'string') msg = code
        throw new Error(msg)
      }
      return payload
    },
    onSuccess: async () => {
      setOpenCnpj(null)
      setConfirmacao('')
      await qc.invalidateQueries({ queryKey: ['admin', 'insights-clientes-cadastro'] })
      await qc.invalidateQueries({ queryKey: ['insights'] })
    },
  })

  function confirmacaoBateCnpj(input: string, cnpj14: string) {
    const digits = input.replace(/\D/g, '')
    if (digits.length < 14) return false
    return digits.slice(-14) === cnpj14
  }

  const opcoesCidade = useMemo(() => {
    const set = new Set<string>()
    for (const r of list.data ?? []) {
      const c = (r.cidade ?? '').trim()
      if (c) set.add(c)
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }))
  }, [list.data])

  const opcoesUf = useMemo(() => {
    const set = new Set<string>()
    for (const r of list.data ?? []) {
      const u = (r.estado ?? '').trim().toUpperCase()
      if (u) set.add(u)
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [list.data])

  useEffect(() => {
    if (filtroCidade !== FILTRO_TODAS && !opcoesCidade.includes(filtroCidade)) {
      setFiltroCidade(FILTRO_TODAS)
    }
  }, [opcoesCidade, filtroCidade])

  useEffect(() => {
    if (filtroUf !== FILTRO_TODAS && !opcoesUf.includes(filtroUf)) {
      setFiltroUf(FILTRO_TODAS)
    }
  }, [opcoesUf, filtroUf])

  /** Valor legado dos selects (antes do sentinela `todos`). */
  useEffect(() => {
    const legacy = '__all__'
    if (filtroCidade === legacy) setFiltroCidade(FILTRO_TODAS)
    if (filtroUf === legacy) setFiltroUf(FILTRO_TODAS)
    if (filtroSituacao === legacy) setFiltroSituacao(FILTRO_TODAS)
  }, [filtroCidade, filtroUf, filtroSituacao])

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase()
    let rows = list.data ?? []

    const cidadeF = filtroCidade === '__all__' ? FILTRO_TODAS : filtroCidade
    const ufF = filtroUf === '__all__' ? FILTRO_TODAS : filtroUf
    const situacaoF = filtroSituacao === '__all__' ? FILTRO_TODAS : filtroSituacao

    if (cidadeF !== FILTRO_TODAS) {
      rows = rows.filter((r) => (r.cidade ?? '').trim() === cidadeF)
    }
    if (ufF !== FILTRO_TODAS) {
      rows = rows.filter((r) => (r.estado ?? '').trim().toUpperCase() === ufF)
    }
    if (situacaoF !== FILTRO_TODAS) {
      rows = rows.filter((r) => matchSituacaoFiltro(r, situacaoF))
    }

    if (!q) return rows
    return rows.filter((r) => {
      const d = insightsCnpjKey(r.cnpj_14).toLowerCase()
      const nom = `${r.nome_cliente ?? ''} ${r.razao_social ?? ''}`.toLowerCase()
      const loc = `${r.cidade ?? ''} ${r.estado ?? ''}`.toLowerCase()
      return d.includes(q) || nom.includes(q) || loc.includes(q) || r.cnpj_14.includes(q)
    })
  }, [busca, list.data, filtroCidade, filtroUf, filtroSituacao])

  useEffect(() => {
    setPage(1)
  }, [busca, filtroCidade, filtroUf, filtroSituacao])

  const totalFiltradas = filtradas.length
  const totalPages = Math.max(1, Math.ceil(totalFiltradas / PAGE_SIZE))

  useEffect(() => {
    setPage((p) => Math.min(p, totalPages))
  }, [totalPages])

  const safePage = Math.min(page, totalPages)
  const inicioIdx = (safePage - 1) * PAGE_SIZE
  const paginaRows = filtradas.slice(inicioIdx, inicioIdx + PAGE_SIZE)
  const fimExib = totalFiltradas === 0 ? 0 : inicioIdx + paginaRows.length

  const erroRpc = purge.isError
    ? purge.error instanceof Error
      ? purge.error.message
      : String(purge.error ?? '')
    : ''

  return (
    <div className="space-y-6 max-w-[1400px] animate-fade-in">
      <PageHeader
        title="Cadastro de clientes Insights"
        description="Dimensão por CNPJ. O lote processa só clientes em estado pending; erro ou nova consulta pontual usando Reconsultar RF na linha. Remover cliente quando necessário."
      />

      <Card className="shadow-card">
        <CardContent className="p-4 space-y-4">
          <div className="space-y-4">
            <FilterField label="Buscar">
              <Input
                id="busca-ins-cli"
                placeholder="CNPJ, nome fantasia, razão social ou cidade…"
                className="h-8 text-sm"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </FilterField>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <FilterField label="Cidade">
                <Select
                  value={filtroCidade}
                  onValueChange={(v) => setFiltroCidade(v ?? FILTRO_TODAS)}
                  disabled={list.isLoading}
                >
                  <SelectTrigger className="h-8 w-full text-sm min-w-0">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={FILTRO_TODAS}>Todos</SelectItem>
                    {opcoesCidade.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FilterField>
              <FilterField label="UF">
                <Select
                  value={filtroUf}
                  onValueChange={(v) => setFiltroUf(v ?? FILTRO_TODAS)}
                  disabled={list.isLoading}
                >
                  <SelectTrigger className="h-8 w-full text-sm min-w-0">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={FILTRO_TODAS}>Todos</SelectItem>
                    {opcoesUf.map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FilterField>
              <FilterField label="Situação na Receita">
                <Select
                  value={filtroSituacao}
                  onValueChange={(v) =>
                    setFiltroSituacao(
                      v == null || v === '' ? FILTRO_TODAS : v
                    )
                  }
                  disabled={list.isLoading}
                >
                  <SelectTrigger className="h-8 w-full text-sm min-w-0">
                    <SelectValue placeholder="Todos">
                      {SITUACAO_NA_RECEITA_LABELS[filtroSituacao] ?? 'Todos'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={FILTRO_TODAS}>Todos</SelectItem>
                    <SelectItem value="ativa">ATIVA (última consulta)</SelectItem>
                    <SelectItem value="inativa">Não ATIVA</SelectItem>
                    <SelectItem value="pendente">Consulta pendente / processando</SelectItem>
                    <SelectItem value="erro">Erro ou não encontrado</SelectItem>
                  </SelectContent>
                </Select>
              </FilterField>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-card" aria-busy={reprocessPendentes.isPending || reprocessUmCliente.isPending}>
        <CardContent className="p-4 space-y-4 text-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/80 pb-4">
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Reprocessar pendentes</span> — fila em lote só
              para clientes em estado <strong className="text-foreground">pending</strong> (até{' '}
              {REPROCESS_BATCH_LIMIT} por clique).
              <span className="hidden lg:inline">
                {' '}
                Equivalente CLI:{' '}
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px] whitespace-nowrap">
                  npm run insights:process-clientes
                </code>
              </span>
              <span className="hidden sm:inline">
                {' '}
                Falhas pontuais ou fora da fila padrão: use <strong className="text-foreground">Reconsultar RF</strong>{' '}
                na linha.
              </span>
            </p>
            <div className="shrink-0">
              <Button
                type="button"
                size="sm"
                className="gap-1.5"
                disabled={!isAdmin || reprocessPendentes.isPending || reprocessUmCliente.isPending}
                onClick={() => {
                  setReprocessMsg(null)
                  reprocessPendentes.reset()
                  reprocessPendentes.mutate()
                }}
              >
                {reprocessPendentes.isPending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    A processar lote…
                  </>
                ) : (
                  <>Reprocessar pendentes (lote)</>
                )}
              </Button>
            </div>
          </div>

          {reprocessPendentes.isPending ? (
            <InsightsReprocessProgressPanel
              elapsedSec={reprocessElapsedSec}
              pendingApprox={pendingCount}
              batchLimit={REPROCESS_BATCH_LIMIT}
            />
          ) : null}

          {!reprocessPendentes.isPending && reprocessMsg ? (
            <p
              className={cn(
                'text-xs rounded-md px-3 py-2 border',
                reprocessPendentes.isError ||
                  reprocessUmCliente.isError ||
                  reprocessMsg.includes('indisponível')
                  ? 'text-destructive border-destructive/30 bg-destructive/5'
                  : 'text-muted-foreground border-border bg-background'
              )}
            >
              {reprocessMsg}
            </p>
          ) : null}

          <div className="rounded-lg border border-border bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border/50 bg-muted/55">
                  <TableHead className="whitespace-nowrap w-[1%]">CNPJ</TableHead>
                  <TableHead className="min-w-48 max-w-56">Cliente</TableHead>
                  <TableHead className="whitespace-nowrap">Local</TableHead>
                  <TableHead className="whitespace-nowrap min-w-30">Progresso</TableHead>
                  <TableHead
                    className="text-center w-12 px-2"
                    title="Nome ou razão social na origem"
                  >
                    Nome
                  </TableHead>
                  <TableHead className="text-center w-12 px-2" title="Cidade e UF preenchidos">
                    Munic.
                  </TableHead>
                  <TableHead className="whitespace-nowrap" title="Consulta Receita Federal (BrasilAPI)">
                    Consulta RF
                  </TableHead>
                  <TableHead className="whitespace-nowrap" title="Situação cadastral na Receita">
                    Situação
                  </TableHead>
                  <TableHead className="w-[1%] text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.isLoading ? (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={TABLE_COLS}>
                        <Skeleton className="h-9 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : filtradas.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={TABLE_COLS}
                      className="text-muted-foreground text-center py-12 text-sm"
                    >
                      Nenhum cliente na dimensão (ou filtros não coincidem com os resultados).
                    </TableCell>
                  </TableRow>
                ) : (
                  paginaRows.map((r, rowIdx) => {
                    const checks = montarChecksCadastroInsights(r)
                    const checkNome = checks.find((c) => c.id === 'nome')!
                    const checkLocal = checks.find((c) => c.id === 'local')!
                    const pct = percentualCadastro(checks)
                    const st = parseInsightsClienteBrasilStatus(r.brasil_enriquecimento_status)
                    const resumo = resumoCadastroRow(pct, st)
                    return (
                      <TableRow
                        key={r.cnpj_14}
                        className={cn(
                          'border-border/50 transition-colors hover:bg-muted/40',
                          rowIdx % 2 === 1 && 'bg-muted/20'
                        )}
                      >
                        <TableCell className="font-mono text-xs tabular-nums whitespace-nowrap">
                          <span title={r.cnpj_14}>{formatCnpjDisplay(r.cnpj_14)}</span>
                        </TableCell>
                        <TableCell className="whitespace-normal align-top max-w-56">
                          <span className="text-sm text-foreground">{r.nome_cliente ?? '—'}</span>
                          {r.razao_social ? (
                            <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                              {r.razao_social}
                            </p>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap text-foreground">
                          {[r.cidade, r.estado].filter(Boolean).join(' / ') || '—'}
                        </TableCell>
                        <TableCell className="align-middle">
                          <div className="flex flex-col gap-1.5 min-w-26">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant={resumo.variant}>{resumo.label}</Badge>
                              <span className="text-xs font-medium tabular-nums text-muted-foreground">
                                {pct}%
                              </span>
                            </div>
                            <div
                              className="h-2 w-full max-w-40 rounded-full bg-muted overflow-hidden"
                              title={`${checks.filter((c) => c.ok).length}/${checks.length} etapas`}
                            >
                              <div
                                className={cn(
                                  'h-full rounded-full transition-all',
                                  pct >= 100
                                    ? 'bg-success'
                                    : pct >= 50
                                      ? 'bg-warning'
                                      : 'bg-muted-foreground/40'
                                )}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center px-2">
                          <span
                            className="inline-flex justify-center"
                            title={checkNome.ok ? 'Ok' : checkNome.detalhe ?? 'Pendente'}
                          >
                            <CheckIcon ok={checkNome.ok} />
                          </span>
                        </TableCell>
                        <TableCell className="text-center px-2">
                          <span
                            className="inline-flex justify-center"
                            title={checkLocal.ok ? 'Ok' : checkLocal.detalhe ?? 'Pendente'}
                          >
                            <CheckIcon ok={checkLocal.ok} />
                          </span>
                        </TableCell>
                        <TableCell className="align-middle">
                          <CelulaConsultaReceita r={r} />
                        </TableCell>
                        <TableCell className="align-middle">
                          <CelulaSituacaoReceita r={r} />
                        </TableCell>
                        <TableCell className="text-right align-middle">
                          <>
                            <div className="flex justify-end">
                              <DropdownMenu>
                                <DropdownMenuTrigger
                                  type="button"
                                  className={cn(
                                    buttonVariants({ variant: 'ghost', size: 'icon' }),
                                    'h-8 w-8 shrink-0'
                                  )}
                                  disabled={
                                    reprocessPendentes.isPending || reprocessUmCliente.isPending
                                  }
                                  aria-label="Ações do cliente"
                                  title="Ações"
                                >
                                  {reprocessUmCliente.isPending &&
                                  reprocessUmCliente.variables === r.cnpj_14 ? (
                                    <Loader2 className="size-4 animate-spin shrink-0" />
                                  ) : (
                                    <MoreVertical className="size-4 shrink-0" />
                                  )}
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" sideOffset={4} className="min-w-44">
                                  <DropdownMenuItem
                                    className="gap-2"
                                    disabled={
                                      !isAdmin ||
                                      !clientePodeReconsultaBrasilApi(r) ||
                                      reprocessPendentes.isPending ||
                                      reprocessUmCliente.isPending
                                    }
                                    title={
                                      clientePodeReconsultaBrasilApi(r)
                                        ? 'Consultar de novo a Receita Federal (BrasilAPI) neste CNPJ'
                                        : 'Já há consulta concluída (ready)'
                                    }
                                    onClick={() => {
                                      setReprocessMsg(null)
                                      reprocessUmCliente.mutate(r.cnpj_14)
                                    }}
                                  >
                                    <RefreshCw className="size-4 shrink-0" />
                                    Reconsultar RF
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    variant="destructive"
                                    className="gap-2"
                                    disabled={
                                      reprocessPendentes.isPending || reprocessUmCliente.isPending
                                    }
                                    onClick={() => {
                                      setOpenCnpj(r.cnpj_14)
                                      purge.reset()
                                    }}
                                  >
                                    <Trash2 className="size-4 shrink-0" /> Remover cliente…
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                            <Dialog
                              open={openCnpj === r.cnpj_14}
                              onOpenChange={(o) => {
                                if (!o) {
                                  setOpenCnpj(null)
                                  setConfirmacao('')
                                  purge.reset()
                                  return
                                }
                                setOpenCnpj(r.cnpj_14)
                              }}
                            >
                              <DialogContent showCloseButton className="max-w-md">
                                <DialogHeader>
                                  <DialogTitle>Remover cliente e todas as NFs?</DialogTitle>
                                </DialogHeader>
                                <p className="text-sm text-muted-foreground">
                                  {r.nome_cliente ? (
                                    <>
                                      <span className="font-medium text-foreground">
                                        {r.nome_cliente}
                                      </span>
                                      {' — '}
                                    </>
                                  ) : null}
                                  CNPJ{' '}
                                  <span className="font-mono text-foreground">
                                    {formatCnpjDisplay(r.cnpj_14)}
                                  </span>
                                  . Todas as notas de sell-out territorial desse cliente e os
                                  respetivos itens serão apagados.
                                </p>
                                <div className="space-y-1.5">
                                  <label
                                    htmlFor={`purge-confirm-${r.cnpj_14}`}
                                    className="text-sm font-medium"
                                  >
                                    Para confirmar, digite o CNPJ deste cliente
                                  </label>
                                  <Input
                                    id={`purge-confirm-${r.cnpj_14}`}
                                    type="text"
                                    inputMode="numeric"
                                    autoComplete="off"
                                    placeholder={formatCnpjDisplay(r.cnpj_14)}
                                    value={confirmacao}
                                    onChange={(e) => setConfirmacao(e.target.value)}
                                    className="font-mono"
                                  />
                                  <p className="text-xs text-muted-foreground">
                                    Aceita com ou sem máscara (ex.{' '}
                                    <code>{formatCnpjDisplay(r.cnpj_14)}</code> ou{' '}
                                    <code>{r.cnpj_14}</code>).
                                  </p>
                                </div>
                                {erroRpc ? (
                                  <p className="text-sm text-red-600 dark:text-red-400">
                                    {erroRpc}
                                  </p>
                                ) : null}
                                <DialogFooter className="gap-2">
                                  <Button
                                    variant="outline"
                                    onClick={() => {
                                      setOpenCnpj(null)
                                      setConfirmacao('')
                                      purge.reset()
                                    }}
                                  >
                                    Cancelar
                                  </Button>
                                  <Button
                                    variant="destructive"
                                    disabled={
                                      !confirmacaoBateCnpj(confirmacao, r.cnpj_14) || purge.isPending
                                    }
                                    onClick={() => {
                                      const p = parseInsightsCnpj(r.cnpj_14)
                                      const norm = p.ok ? p.cnpj14 : insightsCnpjKey(r.cnpj_14)
                                      purge.mutate({
                                        cnpjNorm: norm,
                                        confirmacao,
                                      })
                                    }}
                                  >
                                    {purge.isPending ? 'A apagar…' : 'Confirmar remoção'}
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          </>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {!list.isLoading && totalFiltradas > 0 ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-1 border-t border-border/80">
              <p className="text-xs text-muted-foreground tabular-nums">
                Mostrando{' '}
                <span className="font-medium text-foreground">
                  {inicioIdx + 1}–{fimExib}
                </span>{' '}
                de <span className="font-medium text-foreground">{totalFiltradas}</span>
                {totalPages > 1 ? (
                  <>
                    {' '}
                    · página{' '}
                    <span className="font-medium text-foreground">
                      {safePage}/{totalPages}
                    </span>
                  </>
                ) : null}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="size-4" />
                  Anterior
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Seguinte
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
