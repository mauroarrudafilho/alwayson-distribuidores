import { useMemo, useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  DollarSign,
  MapPin,
  Users,
  Receipt,
  Package,
  ChevronRight,
  ArrowLeft,
  Loader2,
  Building2,
  Target,
  Layers,
  ClipboardList,
  BarChart3,
  TrendingUp,
} from 'lucide-react'
import { PageHeader } from '@/components/distribuidor/PageHeader'
import { KPICard } from '@/components/distribuidor/KPICard'
import { KPIGrid } from '@/components/distribuidor/KPIGrid'
import { FilterBar, FilterField } from '@/components/distribuidor/FilterBar'
import { Card, CardContent } from '@/components/ui/card'
import { InsightsExplorarCard } from '@/components/insights/InsightsExplorarCard'
import {
  TopAcionaveis,
  insightsListMetaClass,
  insightsListTitleClass,
} from '@/components/insights/TopAcionaveis'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { InsightsCidadeDrawer } from '@/components/insights/InsightsCidadeDrawer'
import { InsightsSortableTh } from '@/components/insights/InsightsSortableTh'
import { useInsightsTableSort } from '@/hooks/useInsightsTableSort'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { InsightsSearchField } from '@/components/insights/InsightsSearchField'
import { InsightsTerritorioMap } from '@/components/insights/InsightsTerritorioMap'
import { formatPerCapitaCurrency } from '@/lib/insights-per-capita'
import { lookupCidadeGap } from '@/lib/insights-gap-per-capita'
import { InsightsGapStatus } from '@/components/insights/InsightsGapStatus'
import { InsightsParametrizacaoDialog } from '@/components/insights/InsightsParametrizacaoDialog'
import { useInsightsPotencialExclusions } from '@/hooks/useInsightsPotencialExclusions'
import {
  INSIGHTS_FILTRO_TODOS,
  insightsSelectOnChange,
  insightsSelectValue,
} from '@/lib/insights-filters'
import { formatCidadeUf, formatCnpj, formatCurrency } from '@/lib/format'
import { insightsCicloVivoPeriodo } from '@/lib/periodo'
import type {
  InsightsCidadeRow,
  InsightsClienteComRedeRow,
  InsightsRedeResumoRow,
  InsightsTopCliente,
} from '@/types/insights'
import { InsightsAbaProdutos } from '@/components/insights/InsightsAbaProdutos'
import { InsightsBateOlhoModal } from '@/components/insights/InsightsBateOlhoModal'
import { InsightsClienteBrasilBadge } from '@/components/insights/InsightsClienteBrasilBadge'
import { InsightsContextKpis } from '@/components/insights/InsightsContextKpis'
import { InsightsOticaIntro } from '@/components/insights/InsightsOticaIntro'
import { InsightsTerritorioLens } from '@/components/insights/InsightsTerritorioLens'
import {
  buildClientesKpis,
  buildTerritorioKpis,
} from '@/lib/insights-contextual-kpis'
import { enriquecerCidadesPerCapita } from '@/lib/insights-per-capita'
import { useInsightsPopulacao } from '@/hooks/useInsightsPopulacao'
import { useAuth } from '@/contexts/auth'
import {
  useInsightsBootstrap,
  useInsightsMesGlobal,
  useInsightsRedeResumo,
  useInsightsFiliaisGrupo,
  clienteComRedeToTopCliente,
  insightsCnpjKey,
  formatPeriodoLabel,
  queryErrorMessage,
} from '@/hooks/useInsightsQueries'
import { usePagination } from '@/hooks/usePagination'
import { PaginationBar } from '@/components/ui/pagination-bar'
import { topClientesPrioritarios } from '@/lib/insights-priority'
import {
  useInsightsAcoesByCnpj,
  type InsightsAcaoEstado,
} from '@/hooks/useInsightsAcoes'
import { InsightsAcaoMenu, INSIGHTS_ACAO_LABEL } from '@/components/insights/InsightsAcaoMenu'

function cidadeTerritorioKey(cidade: string | undefined | null, estado: string | undefined | null) {
  const c = (cidade ?? '').trim() || '— sem cidade —'
  const e = (estado ?? '').trim() || '—'
  return `${c}\t${e}`
}

function RedeGrupoDetalhePanel({
  row,
  periodo,
  onBack,
  onSelectFilial,
}: {
  row: InsightsRedeResumoRow
  periodo: { inicio: string; fim: string }
  onBack: () => void
  onSelectFilial: (c: InsightsClienteComRedeRow) => void
}) {
  const { data: filiais = [], isPending } = useInsightsFiliaisGrupo(row.grupo_id)

  const filiaisAccessors = useMemo(
    () => ({
      nome: (c: InsightsClienteComRedeRow) => c.nome_cliente ?? '',
      cidade: (c: InsightsClienteComRedeRow) => formatCidadeUf(c.cidade, c.estado),
      cnpj: (c: InsightsClienteComRedeRow) => c.cnpj_cliente,
      faturamento: (c: InsightsClienteComRedeRow) => c.faturamento_total,
    }),
    []
  )
  const filiaisSort = useInsightsTableSort(filiais, filiaisAccessors, {
    key: 'faturamento',
    dir: 'desc',
  })

  return (
    <div className="animate-page-in">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar
      </button>
      <PageHeader
        eyebrow="Insights · Rede"
        title={row.nome_rede?.trim() || row.grupo_label}
        accent="em detalhe"
        description={
          row.grupo_kind === 'raiz'
            ? `Raiz ${row.grupo_label} · ${formatPeriodoLabel(periodo.inicio)} – ${formatPeriodoLabel(periodo.fim)}`
            : `Rede manual · ${formatPeriodoLabel(periodo.inicio)} – ${formatPeriodoLabel(periodo.fim)}`
        }
      />
      {isPending && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
          <Loader2 className="w-4 h-4 animate-spin" />
          Carregando lojas…
        </div>
      )}
      <KPIGrid columns={4} className="mb-6">
        <KPICard label="Lojas" value={row.total_lojas} icon={Building2} />
        <KPICard label="Faturamento" value={formatCurrency(row.faturamento_total)} icon={DollarSign} />
        <KPICard label="NFs" value={row.total_nfs} icon={Receipt} />
        <KPICard label="SKUs" value={row.total_skus} icon={Package} />
      </KPIGrid>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <InsightsSortableTh
                  label="Loja"
                  active={filiaisSort.sort.key === 'nome'}
                  dir={filiaisSort.sort.dir}
                  onClick={() => filiaisSort.toggle('nome')}
                />
                <InsightsSortableTh
                  label="Cidade / UF"
                  className="hidden sm:table-cell"
                  active={filiaisSort.sort.key === 'cidade'}
                  dir={filiaisSort.sort.dir}
                  onClick={() => filiaisSort.toggle('cidade')}
                />
                <InsightsSortableTh
                  label="CNPJ"
                  className="hidden md:table-cell font-mono text-xs"
                  active={filiaisSort.sort.key === 'cnpj'}
                  dir={filiaisSort.sort.dir}
                  onClick={() => filiaisSort.toggle('cnpj')}
                />
                <InsightsSortableTh
                  label="Faturamento"
                  align="right"
                  active={filiaisSort.sort.key === 'faturamento'}
                  dir={filiaisSort.sort.dir}
                  onClick={() => filiaisSort.toggle('faturamento')}
                />
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filiais.length === 0 && !isPending && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                    Nenhuma loja neste grupo.
                  </TableCell>
                </TableRow>
              )}
              {filiaisSort.sorted.map((c) => (
                <TableRow
                  key={c.cnpj_cliente}
                  className="cursor-pointer"
                  onClick={() => onSelectFilial(c)}
                >
                  <TableCell className="font-medium max-w-[220px] truncate">{c.nome_cliente}</TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                    {formatCidadeUf(c.cidade, c.estado)}
                  </TableCell>
                  <TableCell className="hidden md:table-cell font-mono text-xs text-muted-foreground">
                    {formatCnpj(c.cnpj_cliente)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {formatCurrency(c.faturamento_total)}
                  </TableCell>
                  <TableCell>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Página principal ────────────────────────────────────────────────────────

export function InsightsPanel() {
  const { currentTenant } = useAuth()
  const distribuidorId =
    currentTenant?.tipo === 'distribuidor' ? currentTenant.tenant_id : undefined

  const boot = useInsightsBootstrap()
  const cidades = boot.data?.cidades ?? []
  const clientes = boot.data?.clientes ?? []
  const periodo = boot.data?.periodo ?? { inicio: '—', fim: '—' }
  const periodoLabel = `${formatPeriodoLabel(periodo.inicio)} – ${formatPeriodoLabel(periodo.fim)}`

  const [busca, setBusca] = useState('')
  /** UF compartilhada entre Lojas, Território e Produtos. */
  const [estadoFilter, setEstadoFilter] = useState('')
  const [perfilFilter, setPerfilFilter] = useState('')
  const [clienteDetalhe, setClienteDetalhe] = useState<InsightsTopCliente | null>(null)
  const [insightsTab, setInsightsTab] = useState<'territorio' | 'clientes' | 'produtos'>('clientes')
  const [tabBeforeDetail, setTabBeforeDetail] = useState<'territorio' | 'clientes' | 'produtos'>('clientes')
  const [buscaCliente, setBuscaCliente] = useState('')
  const [acaoFilter, setAcaoFilter] = useState<'todos' | InsightsAcaoEstado>('todos')
  const [searchParams, setSearchParams] = useSearchParams()
  const acoesByCnpj = useInsightsAcoesByCnpj()
  const [clientesSubTab, setClientesSubTab] = useState<'lojas' | 'redes'>('lojas')

  const mesGlobalQ = useInsightsMesGlobal({ enabled: insightsTab === 'territorio' })
  const redeResumo = useInsightsRedeResumo({
    enabled: insightsTab === 'clientes' && clientesSubTab === 'redes',
  })
  const [redeGrupoDetalhe, setRedeGrupoDetalhe] = useState<InsightsRedeResumoRow | null>(null)
  const [redeGrupoReturn, setRedeGrupoReturn] = useState<InsightsRedeResumoRow | null>(null)
  const [buscaRede, setBuscaRede] = useState('')
  const [cidadeDrawer, setCidadeDrawer] = useState<{ cidade: string; estado: string } | null>(
    null
  )

  const openCidadeDrawer = (cidade: string, estado: string) => {
    setCidadeDrawer({ cidade, estado })
  }

  // Deep-link: /insights?cnpj=... abre o cliente direto na aba Clientes.
  useEffect(() => {
    const cnpjParam = searchParams.get('cnpj')
    if (!cnpjParam || !boot.data) return

    const target = insightsCnpjKey(cnpjParam)
    if (target.length !== 14) {
      searchParams.delete('cnpj')
      setSearchParams(searchParams, { replace: true })
      return
    }

    const cliente = boot.data.clientes.find((c) => insightsCnpjKey(c.cnpj_cliente) === target)
    if (cliente) {
      setTabBeforeDetail('clientes')
      setClienteDetalhe(cliente)
    }

    searchParams.delete('cnpj')
    setSearchParams(searchParams, { replace: true })
  }, [searchParams, setSearchParams, boot.data])

  const openClienteDetalhe = (c: InsightsTopCliente) => {
    setTabBeforeDetail(insightsTab)
    setClienteDetalhe(c)
  }

  const cidadesFiltradas = useMemo(() => {
    return cidades.filter((c) => {
      const matchBusca =
        busca === '' ||
        c.cidade.toLowerCase().includes(busca.toLowerCase()) ||
        c.estado.toLowerCase().includes(busca.toLowerCase())
      const matchEstado = estadoFilter === '' || c.estado === estadoFilter
      return matchBusca && matchEstado
    })
  }, [busca, estadoFilter, cidades])

  /** Mapa usa todas as cidades (só busca textual), para manter o choropleth nacional. */
  const cidadesParaMapa = useMemo(() => {
    if (!busca.trim()) return cidades
    const q = busca.toLowerCase()
    return cidades.filter(
      (c) => c.cidade.toLowerCase().includes(q) || c.estado.toLowerCase().includes(q)
    )
  }, [busca, cidades])

  const maxFat = Math.max(...cidades.map((c) => c.faturamento_total), 1)

  const estados = useMemo(() => [...new Set(cidades.map((c) => c.estado))].sort(), [cidades])

  const perfis = useMemo(
    () =>
      [...new Set(clientes.map((c) => c.perfil).filter((p): p is string => !!p && p.trim() !== ''))].sort(),
    [clientes]
  )

  const faturamentoFiltrado = cidadesFiltradas.reduce((s, c) => s + c.faturamento_total, 0)

  /** Escopo da fila / KPIs — sem busca textual (desacoplado da base explorar). */
  const clientesEscopo = useMemo(() => {
    return clientes.filter((c) => {
      const matchUf = estadoFilter === '' || c.estado === estadoFilter
      const matchPerfil = perfilFilter === '' || c.perfil === perfilFilter
      const acao = acoesByCnpj.get(insightsCnpjKey(c.cnpj_cliente))
      const estadoAcao: InsightsAcaoEstado = acao?.estado ?? 'pendente'
      const matchAcao = acaoFilter === 'todos' || estadoAcao === acaoFilter
      return matchUf && matchPerfil && matchAcao
    })
  }, [estadoFilter, perfilFilter, clientes, acoesByCnpj, acaoFilter])

  /** Lista da base explorar — aplica busca universal local. */
  const clientesListaFiltrada = useMemo(() => {
    const raw = buscaCliente.trim()
    if (!raw) return clientesEscopo
    const q = raw.replace(/\D/g, '')
    const nameQ = raw.toLowerCase()
    return clientesEscopo.filter((c) => {
      const cnpjDigits = insightsCnpjKey(c.cnpj_cliente)
      const matchCnpj = q.length >= 2 && cnpjDigits.includes(q)
      const matchNome = c.nome_cliente?.toLowerCase().includes(nameQ) ?? false
      const matchCidade = c.cidade?.toLowerCase().includes(nameQ) ?? false
      const matchUfText = c.estado?.toLowerCase() === nameQ
      const matchRede = c.nome_rede?.toLowerCase().includes(nameQ) ?? false
      const matchPerfilText = c.perfil?.toLowerCase().includes(nameQ) ?? false
      return matchCnpj || matchNome || matchCidade || matchUfText || matchRede || matchPerfilText
    })
  }, [buscaCliente, clientesEscopo])

  const acaoCounts = useMemo(() => {
    const c: Record<'todos' | InsightsAcaoEstado, number> = {
      todos: clientes.length,
      pendente: 0,
      em_acao: 0,
      resolvido: 0,
      snooze: 0,
      arquivado: 0,
    }
    for (const cli of clientes) {
      const a = acoesByCnpj.get(insightsCnpjKey(cli.cnpj_cliente))
      const estado: InsightsAcaoEstado = a?.estado ?? 'pendente'
      c[estado]++
    }
    return c
  }, [clientes, acoesByCnpj])

  // ─── Top acionáveis + paginação ───────────────────────────────────────────
  const clientesTopAcionaveis = useMemo(
    () => topClientesPrioritarios(clientesEscopo, periodo.fim, 10),
    [clientesEscopo, periodo.fim]
  )

  const clientesAccessors = useMemo(
    () => ({
      nome: (c: InsightsTopCliente) => c.nome_cliente ?? '',
      perfil: (c: InsightsTopCliente) => c.perfil ?? '',
      rede: (c: InsightsTopCliente) => c.nome_rede ?? '',
      cidade: (c: InsightsTopCliente) => formatCidadeUf(c.cidade, c.estado),
      faturamento: (c: InsightsTopCliente) => c.faturamento_total,
      skus: (c: InsightsTopCliente) => c.total_skus,
      status: (c: InsightsTopCliente) =>
        acoesByCnpj.get(insightsCnpjKey(c.cnpj_cliente))?.estado ?? 'pendente',
    }),
    [acoesByCnpj]
  )
  const clientesSort = useInsightsTableSort(clientesListaFiltrada, clientesAccessors, {
    key: 'faturamento',
    dir: 'desc',
  })
  const clientesPag = usePagination({
    items: clientesSort.sorted,
    initialPageSize: 25,
    resetKey: `${buscaCliente}|${estadoFilter}|${perfilFilter}|${acaoFilter}|${clientesSort.sort.key}|${clientesSort.sort.dir}`,
  })

  const gruposComUf = useMemo(() => {
    const byRaiz = new Map<string, Set<string>>()
    for (const c of clientes) {
      const raiz = insightsCnpjKey(c.cnpj_cliente).slice(0, 8)
      if (!raiz || !c.estado) continue
      const set = byRaiz.get(raiz) ?? new Set()
      set.add(c.estado)
      byRaiz.set(raiz, set)
    }
    return byRaiz
  }, [clientes])

  const redesFiltradas = useMemo(() => {
    const raw = buscaRede.trim().toLowerCase()
    const digits = raw.replace(/\D/g, '')
    const rows = redeResumo.data ?? []
    return rows.filter((r) => {
      if (estadoFilter) {
        if (r.grupo_kind === 'raiz') {
          const raiz = r.grupo_id.replace(/^auto:/, '')
          const ufs = gruposComUf.get(raiz)
          if (!ufs?.has(estadoFilter)) return false
        } else {
          // Rede manual: mantém se alguma loja do bootstrap com mesmo nome_rede estiver na UF
          const hit = clientes.some(
            (c) => c.nome_rede === r.nome_rede && c.estado === estadoFilter
          )
          if (!hit) return false
        }
      }
      if (!raw) return true
      return (
        r.grupo_label.toLowerCase().includes(raw) ||
        (r.nome_rede?.toLowerCase().includes(raw) ?? false) ||
        (digits.length > 0 && r.grupo_id.replace(/\D/g, '').includes(digits))
      )
    })
  }, [redeResumo.data, buscaRede, estadoFilter, gruposComUf, clientes])

  const redesAccessors = useMemo(
    () => ({
      raiz: (r: InsightsRedeResumoRow) => r.grupo_label ?? '',
      nome: (r: InsightsRedeResumoRow) => r.nome_rede ?? '',
      tipo: (r: InsightsRedeResumoRow) => r.grupo_kind,
      lojas: (r: InsightsRedeResumoRow) => r.total_lojas,
      faturamento: (r: InsightsRedeResumoRow) => r.faturamento_total,
      nfs: (r: InsightsRedeResumoRow) => r.total_nfs,
    }),
    []
  )
  const redesSort = useInsightsTableSort(redesFiltradas, redesAccessors, {
    key: 'faturamento',
    dir: 'desc',
  })
  const redePag = usePagination({
    items: redesSort.sorted,
    initialPageSize: 25,
    resetKey: `${buscaRede}|${estadoFilter}|${redesSort.sort.key}|${redesSort.sort.dir}`,
  })

  const clientesKpis = useMemo(
    () => buildClientesKpis(clientesEscopo, periodo.fim, acaoCounts),
    [clientesEscopo, periodo.fim, acaoCounts]
  )

  const popTerritorioQ = useInsightsPopulacao(
    useMemo(
      () => cidadesFiltradas.map((c) => ({ cidade: c.cidade, estado: c.estado })),
      [cidadesFiltradas]
    ),
    insightsTab === 'territorio' && cidadesFiltradas.length > 0
  )

  const perCapitaFiltrado = useMemo(
    () => enriquecerCidadesPerCapita(cidadesFiltradas, popTerritorioQ.data ?? new Map()),
    [cidadesFiltradas, popTerritorioQ.data]
  )

  const perCapitaByKey = useMemo(() => {
    const m = new Map<string, (typeof perCapitaFiltrado)[number]>()
    for (const c of perCapitaFiltrado) {
      m.set(cidadeTerritorioKey(c.cidade, c.estado), c)
    }
    return m
  }, [perCapitaFiltrado])

  const potencialExclusions = useInsightsPotencialExclusions(perCapitaFiltrado, clientes)
  const gapsCtx = potencialExclusions.gapsCtx

  type CidadeTabelaRow = InsightsCidadeRow & {
    fat_pc: number | null
    populacao: number | null
    gap_faturamento: number | null
    atingido_pct: number | null
    gap_nivel: string | null
  }

  const cidadesTabela = useMemo((): CidadeTabelaRow[] => {
    return cidadesFiltradas.map((row) => {
      const pc = perCapitaByKey.get(cidadeTerritorioKey(row.cidade, row.estado))
      const gap = lookupCidadeGap(gapsCtx, row.cidade, row.estado)
      return {
        ...row,
        fat_pc: pc?.faturamento_per_capita ?? null,
        populacao: pc?.populacao ?? null,
        gap_faturamento: gap?.gap_faturamento ?? null,
        atingido_pct: gap?.atingido_pct ?? null,
        gap_nivel: gap?.nivel ?? null,
      }
    })
  }, [cidadesFiltradas, perCapitaByKey, gapsCtx])

  const cidadesAccessors = useMemo(
    () => ({
      cidade: (r: CidadeTabelaRow) => `${r.cidade} ${r.estado}`,
      faturamento: (r: CidadeTabelaRow) => r.faturamento_total,
      fat_pc: (r: CidadeTabelaRow) => r.fat_pc,
      populacao: (r: CidadeTabelaRow) => r.populacao,
      clientes: (r: CidadeTabelaRow) => r.total_clientes,
      gap: (r: CidadeTabelaRow) => r.gap_faturamento,
      status: (r: CidadeTabelaRow) => r.atingido_pct,
    }),
    []
  )
  const cidadesSort = useInsightsTableSort(cidadesTabela, cidadesAccessors, {
    key: 'faturamento',
    dir: 'desc',
  })
  const cidadesPag = usePagination({
    items: cidadesSort.sorted,
    initialPageSize: 25,
    resetKey: `${busca}|${estadoFilter}|${cidadesSort.sort.key}|${cidadesSort.sort.dir}`,
  })

  const cidadeDrawerRow = useMemo(() => {
    if (!cidadeDrawer) return null
    return (
      cidades.find(
        (c) => c.cidade === cidadeDrawer.cidade && c.estado === cidadeDrawer.estado
      ) ?? null
    )
  }, [cidadeDrawer, cidades])

  const cidadeDrawerPc = useMemo(() => {
    if (!cidadeDrawer) return null
    return (
      perCapitaByKey.get(cidadeTerritorioKey(cidadeDrawer.cidade, cidadeDrawer.estado)) ?? null
    )
  }, [cidadeDrawer, perCapitaByKey])

  const cidadeDrawerGap = useMemo(() => {
    if (!cidadeDrawer) return null
    return lookupCidadeGap(gapsCtx, cidadeDrawer.cidade, cidadeDrawer.estado)
  }, [cidadeDrawer, gapsCtx])

  const territorioKpis = useMemo(
    () => buildTerritorioKpis(cidadesFiltradas, faturamentoFiltrado, perCapitaFiltrado),
    [cidadesFiltradas, faturamentoFiltrado, perCapitaFiltrado]
  )

  const CLIENTES_KPI_ICONS = {
    candidatos: Target,
    potencial: DollarSign,
    pendentes: ClipboardList,
    carteira: Users,
    default: Users,
  }

  const TERRITORIO_KPI_ICONS = {
    concentracao: BarChart3,
    cidades: MapPin,
    fat_pc: TrendingUp,
    vol_pc: Layers,
    clientes_urb: Users,
    default: MapPin,
  }

  // ─── Visão principal (abas) ───────────────────────────────────────────────
  if (boot.isPending) {
    return (
      <div className="animate-page-in flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-sm">Carregando dados de Insights…</p>
      </div>
    )
  }

  if (boot.isError) {
    return (
      <div className="animate-page-in p-6 rounded-lg border border-destructive/30 bg-destructive/5 text-sm text-destructive">
        {queryErrorMessage(boot.error)}
      </div>
    )
  }

  if (redeGrupoDetalhe && !clienteDetalhe) {
    return (
      <div className="animate-page-in">
        <RedeGrupoDetalhePanel
          row={redeGrupoDetalhe}
          periodo={periodo}
          onBack={() => setRedeGrupoDetalhe(null)}
          onSelectFilial={(c) => {
            setRedeGrupoReturn(redeGrupoDetalhe)
            setRedeGrupoDetalhe(null)
            openClienteDetalhe(clienteComRedeToTopCliente(c))
          }}
        />
      </div>
    )
  }

  return (
    <div className="animate-page-in">
      <PageHeader
        title="Insights"
        accent="acionáveis"
        description={`${periodoLabel} · histórico Arruda · ${cidades.length} cidades`}
        actions={
          <InsightsParametrizacaoDialog
            clientes={clientes}
            excluded={potencialExclusions.excluded}
            excludedClientes={potencialExclusions.excludedClientes}
            suggestions={potencialExclusions.suggestions}
            onToggle={potencialExclusions.toggle}
            onAddSuggested={potencialExclusions.addSuggested}
            onClearAll={potencialExclusions.clearAll}
            count={potencialExclusions.count}
            onVerTerritorio={() => setInsightsTab('territorio')}
          />
        }
      />

      <Tabs value={insightsTab} onValueChange={(v) => setInsightsTab(v as 'territorio' | 'clientes' | 'produtos')}>
        <TabsList
          variant="line"
          className="tab-strip mb-5 h-auto w-fit max-w-full gap-5 border-0 border-b border-border/50 bg-transparent p-0 sm:gap-8"
        >
          <TabsTrigger
            value="clientes"
            className="rounded-none border-b-2 border-transparent px-0 py-2 text-[13px] font-medium text-muted-foreground data-active:border-teal data-active:font-semibold data-active:text-foreground"
          >
            Clientes
          </TabsTrigger>
          <TabsTrigger
            value="produtos"
            className="rounded-none border-b-2 border-transparent px-0 py-2 text-[13px] font-medium text-muted-foreground data-active:border-teal data-active:font-semibold data-active:text-foreground"
          >
            Produtos
          </TabsTrigger>
          <TabsTrigger
            value="territorio"
            className="rounded-none border-b-2 border-transparent px-0 py-2 text-[13px] font-medium text-muted-foreground data-active:border-teal data-active:font-semibold data-active:text-foreground"
          >
            Território
          </TabsTrigger>
        </TabsList>

        <TabsContent value="clientes" className="mt-0">
          <InsightsOticaIntro otica="clientes" periodoLabel={periodoLabel} compact />
          <Tabs
            value={clientesSubTab}
            onValueChange={(v) => setClientesSubTab(v as 'lojas' | 'redes')}
          >
            <TabsList
              variant="line"
              className="tab-strip mb-4 h-auto w-fit max-w-full gap-5 border-0 border-b border-border/40 bg-transparent p-0 sm:gap-6"
            >
              <TabsTrigger
                value="lojas"
                className="px-0 py-2 text-sm font-medium text-muted-foreground data-active:text-foreground data-active:font-semibold"
              >
                Lojas
              </TabsTrigger>
              <TabsTrigger
                value="redes"
                className="px-0 py-2 text-sm font-medium text-muted-foreground data-active:text-foreground data-active:font-semibold"
              >
                Redes
              </TabsTrigger>
            </TabsList>
            <TabsContent value="lojas" className="mt-0">
          <FilterBar columns={2}>
            <FilterField label="Estado">
              <Select
                value={insightsSelectValue(estadoFilter)}
                onValueChange={(v) => insightsSelectOnChange(v, setEstadoFilter)}
              >
                <SelectTrigger className="h-9 w-full text-sm min-w-0">
                  <SelectValue placeholder="Todos">
                    {estadoFilter || 'Todos'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={INSIGHTS_FILTRO_TODOS}>Todos</SelectItem>
                  {estados.map((uf) => (
                    <SelectItem key={uf} value={uf}>
                      {uf}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>
            <FilterField label="Perfil do cliente">
              <Select
                value={insightsSelectValue(perfilFilter)}
                onValueChange={(v) => insightsSelectOnChange(v, setPerfilFilter)}
              >
                <SelectTrigger className="h-9 w-full text-sm min-w-0">
                  <SelectValue placeholder="Todos os perfis">
                    {perfilFilter || 'Todos os perfis'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={INSIGHTS_FILTRO_TODOS}>Todos os perfis</SelectItem>
                  {perfis.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>
          </FilterBar>

          <InsightsContextKpis
            kpis={clientesKpis}
            icons={CLIENTES_KPI_ICONS}
            className="mb-5"
          />

          <div className="mb-5 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mr-2">
              Status da ação
            </span>
            {(['todos', 'pendente', 'em_acao', 'resolvido', 'snooze', 'arquivado'] as const).map(
              (estado) => {
                const label = estado === 'todos' ? 'Todos' : INSIGHTS_ACAO_LABEL[estado]
                const count = acaoCounts[estado]
                const active = acaoFilter === estado
                return (
                  <button
                    key={estado}
                    type="button"
                    onClick={() => setAcaoFilter(estado)}
                    className={
                      active
                        ? 'h-7 rounded-md bg-foreground px-2.5 text-xs font-medium text-background'
                        : 'h-7 rounded-md px-2.5 text-xs font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                    }
                  >
                    {label}{' '}
                    <span className="tabular-nums opacity-70">{count}</span>
                  </button>
                )
              }
            )}
          </div>

          {clientesTopAcionaveis.length > 0 && (
            <TopAcionaveis
              eyebrow="Sua fila · Clientes a recuperar"
              description={`Top 10 por faturamento histórico × gap até ${formatPeriodoLabel(periodo.fim)} — prioridade do plano de ação.`}
              items={clientesTopAcionaveis}
              getKey={(c) => c.cnpj_cliente}
              onItemClick={(c) => openClienteDetalhe(c)}
              renderItem={(c) => {
                const ultimaCompra = c.ultima_compra
                  ? new Date(`${c.ultima_compra}T12:00:00`).toLocaleDateString('pt-BR', {
                      month: 'short',
                      year: '2-digit',
                    })
                  : '—'
                return (
                  <div>
                    <p className={insightsListTitleClass}>
                      {c.nome_cliente}
                      {formatCidadeUf(c.cidade, c.estado) ? (
                        <span className="ml-2 text-[10px] font-normal uppercase tracking-wider text-muted-foreground">
                          {formatCidadeUf(c.cidade, c.estado)}
                        </span>
                      ) : null}
                    </p>
                    <p className={insightsListMetaClass}>
                      <span className="font-medium text-foreground">
                        {formatCurrency(c.faturamento_total)}
                      </span>
                      <span className="mx-1 opacity-40">·</span>
                      última {ultimaCompra}
                      {c.__gapMeses > 0 && (
                        <span className="ml-1 text-amber-700 dark:text-amber-500">
                          · {c.__gapMeses}m sem compra
                        </span>
                      )}
                    </p>
                  </div>
                )
              }}
            />
          )}

          <InsightsExplorarCard
            title="Base filtrada"
            countLabel={`${clientesListaFiltrada.length.toLocaleString('pt-BR')} clientes`}
            search={buscaCliente}
            onSearchChange={setBuscaCliente}
            searchPlaceholder="CNPJ, nome, cidade, rede ou perfil…"
          >
              <Table>
                <TableHeader>
                  <TableRow>
                    <InsightsSortableTh
                      label="Cliente"
                      active={clientesSort.sort.key === 'nome'}
                      dir={clientesSort.sort.dir}
                      onClick={() => clientesSort.toggle('nome')}
                    />
                    <InsightsSortableTh
                      label="Perfil"
                      className="hidden md:table-cell"
                      active={clientesSort.sort.key === 'perfil'}
                      dir={clientesSort.sort.dir}
                      onClick={() => clientesSort.toggle('perfil')}
                    />
                    <InsightsSortableTh
                      label="Rede"
                      className="hidden lg:table-cell max-w-[140px]"
                      active={clientesSort.sort.key === 'rede'}
                      dir={clientesSort.sort.dir}
                      onClick={() => clientesSort.toggle('rede')}
                    />
                    <InsightsSortableTh
                      label="Cidade / UF"
                      className="hidden sm:table-cell"
                      active={clientesSort.sort.key === 'cidade'}
                      dir={clientesSort.sort.dir}
                      onClick={() => clientesSort.toggle('cidade')}
                    />
                    <InsightsSortableTh
                      label="Faturamento"
                      align="right"
                      active={clientesSort.sort.key === 'faturamento'}
                      dir={clientesSort.sort.dir}
                      onClick={() => clientesSort.toggle('faturamento')}
                    />
                    <InsightsSortableTh
                      label="SKUs"
                      align="right"
                      className="hidden lg:table-cell"
                      active={clientesSort.sort.key === 'skus'}
                      dir={clientesSort.sort.dir}
                      onClick={() => clientesSort.toggle('skus')}
                    />
                    <InsightsSortableTh
                      label="Status"
                      align="right"
                      className="w-36"
                      active={clientesSort.sort.key === 'status'}
                      dir={clientesSort.sort.dir}
                      onClick={() => clientesSort.toggle('status')}
                    />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientesListaFiltrada.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-10">
                        Nenhum cliente encontrado.
                      </TableCell>
                    </TableRow>
                  )}
                  {clientesPag.paginated.map((c) => (
                    <TableRow
                      key={c.cnpj_cliente}
                      className="cursor-pointer"
                      onClick={() => openClienteDetalhe(c)}
                    >
                      <TableCell className="font-medium max-w-[220px]">
                        <span className="flex items-center gap-2">
                          <span className="truncate">{c.nome_cliente}</span>
                          <InsightsClienteBrasilBadge status={c.brasil_enriquecimento_status} />
                        </span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {c.perfil ? (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 max-w-[140px] truncate" title={c.perfil}>
                            {c.perfil}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground/60">—</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground max-w-[160px]">
                        <span className="truncate block" title={c.nome_rede}>
                          {c.nome_rede ?? '—'}
                        </span>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                        {formatCidadeUf(c.cidade, c.estado)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {formatCurrency(c.faturamento_total)}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-right tabular-nums">{c.total_skus}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1.5">
                          <InsightsAcaoMenu
                            cnpj={c.cnpj_cliente}
                            acao={acoesByCnpj.get(insightsCnpjKey(c.cnpj_cliente))}
                          />
                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <PaginationBar
                page={clientesPag.page}
                pageSize={clientesPag.pageSize}
                total={clientesPag.total}
                onPageChange={clientesPag.setPage}
                onPageSizeChange={clientesPag.setPageSize}
              />
          </InsightsExplorarCard>
            </TabsContent>
            <TabsContent value="redes" className="mt-0 space-y-4">
              <FilterBar columns={2}>
                <FilterField label="Buscar rede">
                  <InsightsSearchField
                    value={buscaRede}
                    onChange={setBuscaRede}
                    placeholder="Raiz CNPJ ou nome da rede…"
                  />
                </FilterField>
                <FilterField label="Estado">
                  <Select
                    value={insightsSelectValue(estadoFilter)}
                    onValueChange={(v) => insightsSelectOnChange(v, setEstadoFilter)}
                  >
                    <SelectTrigger className="h-9 w-full text-sm min-w-0">
                      <SelectValue placeholder="Todos">
                        {estadoFilter || 'Todos'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={INSIGHTS_FILTRO_TODOS}>Todos</SelectItem>
                      {estados.map((uf) => (
                        <SelectItem key={uf} value={uf}>
                          {uf}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FilterField>
              </FilterBar>
              {redeResumo.isError && (
                <p className="text-sm text-destructive">
                  {queryErrorMessage(redeResumo.error) || 'Não foi possível carregar redes.'}
                </p>
              )}
              {redeResumo.isPending && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Carregando redes…
                </div>
              )}
              {!redeResumo.isPending && !redeResumo.isError && (
                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <InsightsSortableTh
                            label="Raiz CNPJ"
                            className="font-mono text-xs whitespace-nowrap"
                            active={redesSort.sort.key === 'raiz'}
                            dir={redesSort.sort.dir}
                            onClick={() => redesSort.toggle('raiz')}
                          />
                          <InsightsSortableTh
                            label="Nome rede"
                            className="min-w-[120px] max-w-[220px]"
                            active={redesSort.sort.key === 'nome'}
                            dir={redesSort.sort.dir}
                            onClick={() => redesSort.toggle('nome')}
                          />
                          <InsightsSortableTh
                            label="Tipo"
                            className="w-24"
                            active={redesSort.sort.key === 'tipo'}
                            dir={redesSort.sort.dir}
                            onClick={() => redesSort.toggle('tipo')}
                          />
                          <InsightsSortableTh
                            label="Lojas"
                            align="right"
                            active={redesSort.sort.key === 'lojas'}
                            dir={redesSort.sort.dir}
                            onClick={() => redesSort.toggle('lojas')}
                          />
                          <InsightsSortableTh
                            label="Faturamento"
                            align="right"
                            active={redesSort.sort.key === 'faturamento'}
                            dir={redesSort.sort.dir}
                            onClick={() => redesSort.toggle('faturamento')}
                          />
                          <InsightsSortableTh
                            label="NFs"
                            align="right"
                            className="hidden md:table-cell"
                            active={redesSort.sort.key === 'nfs'}
                            dir={redesSort.sort.dir}
                            onClick={() => redesSort.toggle('nfs')}
                          />
                          <TableHead className="w-8" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {redesFiltradas.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-10">
                              Nenhuma rede encontrada.
                            </TableCell>
                          </TableRow>
                        )}
                        {redePag.paginated.map((r) => (
                          <TableRow
                            key={`${r.grupo_kind}-${r.grupo_id}`}
                            className="cursor-pointer"
                            onClick={() => setRedeGrupoDetalhe(r)}
                          >
                            <TableCell className="font-mono text-xs tabular-nums text-muted-foreground">
                              {r.grupo_kind === 'raiz' ? r.grupo_label : '—'}
                            </TableCell>
                            <TableCell className="font-medium max-w-[220px]">
                              <span className="flex items-center gap-2">
                                <Building2 className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                                <span className="truncate" title={r.nome_rede ?? undefined}>
                                  {r.nome_rede?.trim() || '—'}
                                </span>
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge variant={r.grupo_kind === 'manual' ? 'default' : 'secondary'} className="text-[10px]">
                                {r.grupo_kind === 'manual' ? 'Manual' : 'Raiz'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{r.total_lojas}</TableCell>
                            <TableCell className="text-right tabular-nums font-medium">
                              {formatCurrency(r.faturamento_total)}
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-right tabular-nums">
                              {r.total_nfs}
                            </TableCell>
                            <TableCell>
                              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50" />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <PaginationBar
                      page={redePag.page}
                      pageSize={redePag.pageSize}
                      total={redePag.total}
                      onPageChange={redePag.setPage}
                      onPageSizeChange={redePag.setPageSize}
                    />
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="territorio" className="mt-0">
          <InsightsOticaIntro otica="territorio" periodoLabel={periodoLabel} compact />
          <FilterBar columns={2}>
            <FilterField label="Estado">
              <Select
                value={insightsSelectValue(estadoFilter)}
                onValueChange={(v) => insightsSelectOnChange(v, setEstadoFilter)}
              >
                <SelectTrigger className="h-9 w-full text-sm min-w-0">
                  <SelectValue placeholder="Todos">
                    {estadoFilter || 'Todos'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={INSIGHTS_FILTRO_TODOS}>Todos</SelectItem>
                  {estados.map((uf) => (
                    <SelectItem key={uf} value={uf}>
                      {uf}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>
          </FilterBar>

          <InsightsContextKpis
            kpis={territorioKpis}
            icons={TERRITORIO_KPI_ICONS}
            className="mb-5"
          />

          <InsightsTerritorioMap
            cidades={cidadesParaMapa}
            estadoFilter={estadoFilter}
            cidadeFilter={busca}
            onSelectUf={(uf) => {
              // Clique de novo na mesma UF → visão macro (Nordeste)
              if (uf && estadoFilter === uf) {
                setEstadoFilter('')
                setBusca('')
                return
              }
              setEstadoFilter(uf)
              if (!uf) setBusca('')
            }}
            onSelectCidade={(cidade, estado) => {
              // Clique de novo na mesma cidade → volta ao Nordeste
              if (
                busca.trim().toLowerCase() === cidade.trim().toLowerCase() &&
                estadoFilter === estado
              ) {
                setBusca('')
                setEstadoFilter('')
                return
              }
              setBusca(cidade)
              setEstadoFilter(estado)
            }}
          />

          <InsightsTerritorioLens
            cidades={cidadesFiltradas}
            faturamentoFiltrado={faturamentoFiltrado}
            mesGlobal={mesGlobalQ.data ?? []}
            onOpenCidade={openCidadeDrawer}
            gapsCtx={gapsCtx}
          />

          <InsightsExplorarCard
            title="Explorar cidades"
            countLabel={`${cidadesFiltradas.length.toLocaleString('pt-BR')} no recorte`}
            search={busca}
            onSearchChange={setBusca}
            searchPlaceholder="Buscar cidade…"
          >
              <Table>
                <TableHeader>
                  <TableRow>
                    <InsightsSortableTh
                      label="Cidade"
                      active={cidadesSort.sort.key === 'cidade'}
                      dir={cidadesSort.sort.dir}
                      onClick={() => cidadesSort.toggle('cidade')}
                    />
                    <InsightsSortableTh
                      label="Faturamento"
                      align="right"
                      active={cidadesSort.sort.key === 'faturamento'}
                      dir={cidadesSort.sort.dir}
                      onClick={() => cidadesSort.toggle('faturamento')}
                    />
                    <InsightsSortableTh
                      label="Fat. / hab"
                      align="right"
                      active={cidadesSort.sort.key === 'fat_pc'}
                      dir={cidadesSort.sort.dir}
                      onClick={() => cidadesSort.toggle('fat_pc')}
                    />
                    <InsightsSortableTh
                      label="Habitantes"
                      align="right"
                      className="hidden sm:table-cell"
                      active={cidadesSort.sort.key === 'populacao'}
                      dir={cidadesSort.sort.dir}
                      onClick={() => cidadesSort.toggle('populacao')}
                    />
                    <InsightsSortableTh
                      label="Clientes"
                      align="right"
                      className="hidden md:table-cell"
                      active={cidadesSort.sort.key === 'clientes'}
                      dir={cidadesSort.sort.dir}
                      onClick={() => cidadesSort.toggle('clientes')}
                    />
                    <InsightsSortableTh
                      label="Status"
                      active={cidadesSort.sort.key === 'status'}
                      dir={cidadesSort.sort.dir}
                      onClick={() => cidadesSort.toggle('status')}
                    />
                    <InsightsSortableTh
                      label="Gap"
                      align="right"
                      className="hidden lg:table-cell"
                      active={cidadesSort.sort.key === 'gap'}
                      dir={cidadesSort.sort.dir}
                      onClick={() => cidadesSort.toggle('gap')}
                    />
                    <TableHead className="hidden xl:table-cell">Participação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cidadesFiltradas.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">
                        Nenhuma cidade encontrada para os filtros selecionados.
                      </TableCell>
                    </TableRow>
                  )}
                  {cidadesPag.paginated.map((row) => {
                    const k = cidadeTerritorioKey(row.cidade, row.estado)
                    const gap = lookupCidadeGap(gapsCtx, row.cidade, row.estado)
                    return (
                      <TableRow
                        key={k}
                        className="cursor-pointer"
                        onClick={() => openCidadeDrawer(row.cidade, row.estado)}
                      >
                        <TableCell>
                          <span className="flex items-center gap-1.5">
                            <span className="font-medium">{row.cidade}</span>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              {row.estado}
                            </Badge>
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {formatCurrency(row.faturamento_total)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm font-medium text-teal">
                          {row.fat_pc != null ? formatPerCapitaCurrency(row.fat_pc) : '—'}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-right tabular-nums text-muted-foreground">
                          {row.populacao != null ? row.populacao.toLocaleString('pt-BR') : '—'}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-right tabular-nums">
                          {row.total_clientes}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <InsightsGapStatus gap={gap} />
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-right tabular-nums text-sm">
                          {row.gap_faturamento != null
                            ? formatCurrency(row.gap_faturamento)
                            : '—'}
                        </TableCell>
                        <TableCell className="hidden xl:table-cell">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-3 bg-muted/50 rounded overflow-hidden">
                              <div
                                className="h-full bg-primary/70 rounded"
                                style={{
                                  width: `${(row.faturamento_total / maxFat) * 100}%`,
                                }}
                              />
                            </div>
                            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
              <PaginationBar
                page={cidadesPag.page}
                pageSize={cidadesPag.pageSize}
                total={cidadesPag.total}
                onPageChange={cidadesPag.setPage}
                onPageSizeChange={cidadesPag.setPageSize}
              />
          </InsightsExplorarCard>
        </TabsContent>

        <TabsContent value="produtos" className="mt-0">
          <InsightsAbaProdutos
            periodoLabel={periodoLabel}
            active={insightsTab === 'produtos'}
            estadoFilter={estadoFilter}
            onEstadoChange={setEstadoFilter}
            estados={estados}
          />
        </TabsContent>
      </Tabs>

      <InsightsCidadeDrawer
        open={cidadeDrawer != null}
        onOpenChange={(open) => {
          if (!open) setCidadeDrawer(null)
        }}
        target={cidadeDrawer}
        cidadeRow={cidadeDrawerRow}
        perCapita={cidadeDrawerPc}
        gap={cidadeDrawerGap}
        clientes={clientes}
        onSelectCliente={(c) => {
          setCidadeDrawer(null)
          openClienteDetalhe(c)
        }}
      />

      {clienteDetalhe && (
        <InsightsBateOlhoModal
          open
          context="insights"
          cliente={clienteDetalhe}
          acao={acoesByCnpj.get(insightsCnpjKey(clienteDetalhe.cnpj_cliente))}
          /** Sell-out atual: jan/2025 → mês vigente (não o arquivo Arruda 2022–2024). */
          periodoAnalise={insightsCicloVivoPeriodo()}
          distribuidorId={distribuidorId}
          onOpenChange={(open) => {
            if (open) return
            setClienteDetalhe(null)
            if (redeGrupoReturn) {
              setRedeGrupoDetalhe(redeGrupoReturn)
              setRedeGrupoReturn(null)
              setInsightsTab('clientes')
              setClientesSubTab('redes')
            } else {
              setInsightsTab(tabBeforeDetail)
            }
          }}
        />
      )}
    </div>
  )
}
