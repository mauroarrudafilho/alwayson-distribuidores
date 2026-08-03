import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Map, Target, PieChart, Loader2 } from 'lucide-react'
import { PageHeader } from '@/components/distribuidor/PageHeader'
import { FilterBar } from '@/components/distribuidor/FilterBar'
import { SnapshotStrip, type SnapshotItem } from '@/components/distribuidor/SnapshotStrip'
import { EmptyState } from '@/components/distribuidor/EmptyState'
import {
  FilterCidadeSelect,
  FilterEntitySelect,
  FilterReadonly,
} from '@/components/explorar/ExplorarFiltros'
import { ExplorarPrioridadeTab } from '@/components/explorar/ExplorarPrioridadeTab'
import { ExplorarCoberturaTab } from '@/components/explorar/ExplorarCoberturaTab'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/contexts/auth'
import { useCidadesDoDistribuidor } from '@/hooks/useDistribuidorAreaAtuacao'
import { useDistribuidores, useFornecedoresDoDistribuidor } from '@/hooks/useDistribuidores'
import {
  useExplorarCobertura,
  useExplorarMapa,
  useExplorarPrioridade,
  useExplorarResumo,
} from '@/hooks/useExplorar'

const ExplorarMapa = lazy(() =>
  import('@/components/explorar/ExplorarMapa').then((m) => ({ default: m.ExplorarMapa }))
)

export function ExplorarPanel() {
  const { currentTenant } = useAuth()
  const { data: distribuidores, isLoading: loadingDist } = useDistribuidores()

  const [distribuidorId, setDistribuidorId] = useState<string>('')
  const [fornecedorId, setFornecedorId] = useState<string>('')
  const [codigoIbge, setCodigoIbge] = useState<number | 'all'>('all')

  const isDistribuidorTenant = currentTenant?.tipo === 'distribuidor'
  const isFornecedorTenant = currentTenant?.tipo === 'fornecedor'

  useEffect(() => {
    if (isDistribuidorTenant) {
      setDistribuidorId(currentTenant.tenant_id)
    }
  }, [isDistribuidorTenant, currentTenant?.tenant_id])

  useEffect(() => {
    if (!isDistribuidorTenant && !distribuidorId && distribuidores?.length === 1) {
      setDistribuidorId(distribuidores[0].id)
    }
  }, [isDistribuidorTenant, distribuidores, distribuidorId])

  const { data: fornecedores } = useFornecedoresDoDistribuidor(distribuidorId || undefined)
  const { data: cidades } = useCidadesDoDistribuidor(distribuidorId || undefined)

  useEffect(() => {
    if (isFornecedorTenant) {
      setFornecedorId(currentTenant.tenant_id)
    } else if (fornecedores?.length === 1) {
      setFornecedorId(fornecedores[0].id)
    } else if (fornecedorId && !fornecedores?.some((f) => f.id === fornecedorId)) {
      setFornecedorId(fornecedores?.[0]?.id ?? '')
    }
  }, [isFornecedorTenant, currentTenant?.tenant_id, fornecedores, fornecedorId])

  useEffect(() => {
    if (cidades?.length === 1) setCodigoIbge(cidades[0].codigo_ibge)
    else if (cidades?.length && codigoIbge !== 'all') {
      const ok = cidades.some((c) => c.codigo_ibge === codigoIbge)
      if (!ok) setCodigoIbge('all')
    }
  }, [cidades, codigoIbge])

  const codigoIbgeFilter = codigoIbge === 'all' ? null : codigoIbge

  const prioridadeQ = useExplorarPrioridade(
    distribuidorId || undefined,
    fornecedorId || undefined,
    codigoIbgeFilter
  )
  const coberturaQ = useExplorarCobertura(
    distribuidorId || undefined,
    fornecedorId || undefined,
    codigoIbgeFilter
  )
  const mapaQ = useExplorarMapa(
    distribuidorId || undefined,
    fornecedorId || undefined,
    codigoIbgeFilter
  )

  const resumo = useExplorarResumo(coberturaQ.data, prioridadeQ.data)

  const distribuidorOptions = useMemo(
    () => (distribuidores ?? []).map((d) => ({ id: d.id, nome: d.nome })),
    [distribuidores]
  )
  const fornecedorOptions = useMemo(
    () => (fornecedores ?? []).map((f) => ({ id: f.id, nome: f.nome })),
    [fornecedores]
  )

  const snapshotItems: SnapshotItem[] = useMemo(() => {
    if (!resumo) return []
    return [
      {
        label: 'Qualificados',
        value: String(resumo.qualificados),
        delta: 'na praça',
        tone: 'flat',
      },
      {
        label: 'Cobertura',
        value: resumo.coberturaPct != null ? `${resumo.coberturaPct.toFixed(1)}%` : '—',
        delta: `${resumo.atendidos} atendidos`,
        tone: 'flat',
      },
      {
        label: 'Oportunidades A/B',
        value: String(resumo.oportunidadesAb),
        delta: 'fora da carteira',
        tone: resumo.oportunidadesAb > 0 ? 'up' : 'flat',
      },
      {
        label: 'Subexplorados',
        value: String(resumo.subexplorados),
        delta: 'carteira',
        tone: resumo.subexplorados > 0 ? 'down' : 'flat',
      },
      {
        label: 'Índice aberto',
        value: String(Math.round(resumo.relevanciaNaoAtendida)),
        delta: 'soma relevância',
        tone: 'flat',
      },
    ]
  }, [resumo])

  const ready = !!distribuidorId && !!fornecedorId
  const filterCols = useMemo(() => {
    let n = 0
    if (!isDistribuidorTenant) n++
    if (!isFornecedorTenant) n++
    if ((cidades?.length ?? 0) > 0) n++
    return (Math.min(Math.max(n, 1), 4) as 2 | 3 | 4)
  }, [isDistribuidorTenant, isFornecedorTenant, cidades?.length])

  return (
    <div className="animate-page-in">
      <PageHeader
        eyebrow="Inteligência de PDV"
        title="Explorar"
        accent="território"
        description="quem poderia comprar — priorização e cobertura na praça"
      />

      <div className="mb-5 rounded-lg border border-border/60 bg-gradient-to-br from-navy/[0.03] to-teal/[0.04] px-4 py-3.5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-teal/90">
          Diferente do Insights
        </p>
        <h2 className="mt-1 font-display text-base font-normal text-foreground">
          Relevância na praça, não histórico demonstrado
        </h2>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          O <strong className="font-medium text-foreground">Insights</strong> mostra o que a operação
          anterior já vendeu (jan/2022–dez/2024). O{' '}
          <strong className="font-medium text-foreground">Explorar</strong> classifica PDVs qualificados
          na praça por probabilidade de consolidação — rede de lojas e maturidade na região — e mostra
          onde a cobertura ainda é baixa.
        </p>
        <p className="mt-2 max-w-3xl text-xs leading-relaxed text-muted-foreground/90">
          <strong className="font-medium text-foreground/90">Índice (v1):</strong> 55% rede (filiais na
          mesma raiz CNPJ) + 45% maturidade (tempo de abertura), escala 0–100. Sem palpite de faturamento
          por CNAE. Bolhas: cor = segmento, tamanho = relevância (0–100).
        </p>
      </div>

      <FilterBar columns={filterCols}>
        {isDistribuidorTenant ? (
          <FilterReadonly label="Distribuidor" value={currentTenant?.nome ?? '—'} />
        ) : (
          <FilterEntitySelect
            label="Distribuidor"
            value={distribuidorId}
            options={distribuidorOptions}
            onChange={setDistribuidorId}
            placeholder="Selecione o distribuidor"
            disabled={loadingDist}
          />
        )}
        {isFornecedorTenant ? (
          <FilterReadonly label="Fornecedor" value={currentTenant?.nome ?? '—'} />
        ) : (
          <FilterEntitySelect
            label="Fornecedor"
            value={fornecedorId}
            options={fornecedorOptions}
            onChange={setFornecedorId}
            placeholder="Selecione o fornecedor"
            disabled={!distribuidorId}
          />
        )}
        {cidades && cidades.length > 0 && (
          <FilterCidadeSelect value={codigoIbge} cidades={cidades} onChange={setCodigoIbge} />
        )}
      </FilterBar>

      {!ready && !loadingDist && (
        <EmptyState
          icon={Map}
          title="Selecione parceiro e fornecedor"
          description="Escolha o recorte distribuidor × fornecedor para carregar prioridade e cobertura."
        />
      )}

      {ready && (
        <>
          {coberturaQ.isLoading ? (
            <Skeleton className="mb-5 h-[72px] w-full rounded-lg" />
          ) : (
            resumo && <SnapshotStrip items={snapshotItems} className="mb-5" />
          )}

          <Tabs defaultValue="mapa" className="space-y-4">
            <TabsList className="h-auto flex-wrap justify-start gap-1 bg-transparent p-0">
              <TabsTrigger
                value="mapa"
                className="gap-1.5 data-[state=active]:bg-navy data-[state=active]:text-white"
              >
                <Map className="h-3.5 w-3.5" />
                Mapa
              </TabsTrigger>
              <TabsTrigger
                value="prioridade"
                className="gap-1.5 data-[state=active]:bg-navy data-[state=active]:text-white"
              >
                <Target className="h-3.5 w-3.5" />
                Prioridade
              </TabsTrigger>
              <TabsTrigger
                value="cobertura"
                className="gap-1.5 data-[state=active]:bg-navy data-[state=active]:text-white"
              >
                <PieChart className="h-3.5 w-3.5" />
                Cobertura
              </TabsTrigger>
            </TabsList>

            <TabsContent value="mapa">
              {mapaQ.isLoading ? (
                <Skeleton className="h-[400px] w-full rounded-lg" />
              ) : mapaQ.isError ? (
                <EmptyState
                  icon={Map}
                  title="Erro ao carregar mapa"
                  description="Não foi possível ler os PDVs geocodificados."
                />
              ) : !mapaQ.data?.length ? (
                <EmptyState
                  icon={Map}
                  title="Sem pontos no mapa"
                  description="Rode CNEFE + score e confira se há endereços com geocode confiável na praça."
                />
              ) : (
                <Suspense
                  fallback={
                    <div className="flex h-[400px] items-center justify-center text-muted-foreground">
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Carregando mapa…
                    </div>
                  }
                >
                  <ExplorarMapa pontos={mapaQ.data} />
                </Suspense>
              )}
            </TabsContent>

            <TabsContent value="prioridade">
              <ExplorarPrioridadeTab
                rows={prioridadeQ.data}
                isLoading={prioridadeQ.isLoading}
                isError={prioridadeQ.isError}
              />
            </TabsContent>

            <TabsContent value="cobertura">
              <ExplorarCoberturaTab
                rows={coberturaQ.data}
                isLoading={coberturaQ.isLoading}
                isError={coberturaQ.isError}
                distribuidorId={distribuidorId || undefined}
                fornecedorId={fornecedorId || undefined}
                codigoIbge={codigoIbgeFilter}
              />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  )
}
