import { useEffect, useMemo, useState } from 'react'
import L from 'leaflet'
import { GeoJSON, MapContainer, TileLayer, useMap } from 'react-leaflet'
import type { Feature, FeatureCollection, Geometry } from 'geojson'
import type { Layer, PathOptions } from 'leaflet'
import { ArrowLeft, Loader2, Map as MapIcon } from 'lucide-react'
import 'leaflet/dist/leaflet.css'
import type { InsightsCidadeRow } from '@/types/insights'
import { formatCurrency } from '@/lib/format'
import { UF_CODES, cidadeUfKey } from '@/lib/ibge-populacao'
import {
  INSIGHTS_UF_CODES_NORDESTE,
  INSIGHTS_UFS_NORDESTE,
  isInsightsUfNordeste,
} from '@/lib/insights-territorio'
import {
  enriquecerCidadesPerCapita,
  formatPerCapitaCurrency,
  type CidadePerCapita,
} from '@/lib/insights-per-capita'
import { useInsightsIbgeMeta, lookupIbgeMeta } from '@/hooks/useInsightsIbgeMeta'
import { cn } from '@/lib/utils'

const IBGE_UF_MALHA =
  'https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=UF'

const NE_UF_CODE_SET = new Set(
  Object.values(INSIGHTS_UF_CODES_NORDESTE).map((c) => String(c))
)

/** Enquadramento da abertura (~zoom 5–5.5): Nordeste inteiro, sem cortar MA/BA. */
const MAP_CENTER_NORDESTE: [number, number] = [-9.0, -40.5]
const MAP_ZOOM_NORDESTE = 5
/** Bounds do Nordeste com folga para o fitBounds não “comer” as pontas. */
const NE_BOUNDS: [[number, number], [number, number]] = [
  [-18.2, -48.2],
  [-1.2, -34.5],
]

function ibgeMunicipiosMalha(ufCode: number) {
  return `https://servicodados.ibge.gov.br/api/v3/malhas/estados/${ufCode}?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=municipio`
}

const CODE_TO_UF = Object.fromEntries(
  Object.entries(UF_CODES).map(([uf, code]) => [String(code), uf])
) as Record<string, string>

function filterGeoNordeste(geo: FeatureCollection): FeatureCollection {
  return {
    ...geo,
    type: 'FeatureCollection',
    features: (geo.features ?? []).filter((f) => {
      const code = String((f.properties as { codarea?: string } | null)?.codarea ?? '')
      return NE_UF_CODE_SET.has(code)
    }),
  }
}

type UfAgg = {
  uf: string
  fat: number
  cidades: number
  clientes: number
}

type Props = {
  cidades: InsightsCidadeRow[]
  estadoFilter: string
  /** Cidade ativa na busca/explorar — clique de novo volta ao Nordeste. */
  cidadeFilter?: string
  onSelectUf: (uf: string) => void
  onSelectCidade: (cidade: string, estado: string) => void
  className?: string
}

function titleCaseMunicipio(norm: string): string {
  return norm
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/** Zoom só com ⌘/Ctrl + scroll — não intercepta o scroll da página. */
function CmdScrollZoom() {
  const map = useMap()
  useEffect(() => {
    const el = map.getContainer()
    const onWheel = (e: WheelEvent) => {
      if (!e.metaKey && !e.ctrlKey) return
      e.preventDefault()
      e.stopPropagation()
      const step = map.options.zoomSnap || 0.25
      const next = map.getZoom() - Math.sign(e.deltaY) * step
      map.setZoom(next)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [map])
  return null
}

function FitGeo({
  geo,
  maxZoom,
  padding = 28,
  /** Bounds fixos (abertura Nordeste) — evita over-zoom do fitBounds na malha. */
  fixedBounds,
}: {
  geo: FeatureCollection | null
  maxZoom: number
  padding?: number
  fixedBounds?: [[number, number], [number, number]]
}) {
  const map = useMap()
  useEffect(() => {
    if (!geo?.features?.length && !fixedBounds) return
    let cancelled = false

    const apply = () => {
      if (cancelled) return
      map.invalidateSize()
      const bounds = fixedBounds
        ? L.latLngBounds(fixedBounds[0], fixedBounds[1])
        : L.geoJSON(geo as never).getBounds()
      if (!bounds.isValid()) return
      map.fitBounds(bounds, { padding: [padding, padding], maxZoom, animate: false })
    }

    map.whenReady(apply)
    const t0 = window.setTimeout(apply, 50)
    const t1 = window.setTimeout(apply, 250)
    const container = map.getContainer()
    const ro =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            window.requestAnimationFrame(apply)
          })
        : null
    if (ro && container) ro.observe(container)

    return () => {
      cancelled = true
      window.clearTimeout(t0)
      window.clearTimeout(t1)
      ro?.disconnect()
    }
  }, [geo, map, maxZoom, padding, fixedBounds])
  return null
}

function fatColor(pct: number, selected: boolean): string {
  if (selected) return 'oklch(0.52 0.12 200)'
  if (pct <= 0) return 'oklch(0.92 0.01 220)'
  if (pct < 0.05) return 'oklch(0.88 0.04 200)'
  if (pct < 0.1) return 'oklch(0.78 0.07 200)'
  if (pct < 0.2) return 'oklch(0.68 0.1 200)'
  return 'oklch(0.58 0.13 200)'
}

/** Intensidade de cor no município = fat./hab relativo ao máximo da UF. */
function perCapitaFill(fatPc: number, maxFatPc: number): string {
  if (maxFatPc <= 0 || fatPc <= 0) return 'oklch(0.94 0.01 220)'
  const t = Math.sqrt(fatPc / maxFatPc)
  if (t < 0.2) return 'oklch(0.9 0.03 200)'
  if (t < 0.4) return 'oklch(0.82 0.06 200)'
  if (t < 0.6) return 'oklch(0.72 0.09 200)'
  if (t < 0.8) return 'oklch(0.62 0.12 200)'
  return 'oklch(0.52 0.14 200)'
}

export function InsightsTerritorioMap({
  cidades,
  estadoFilter,
  cidadeFilter = '',
  onSelectUf,
  onSelectCidade,
  className,
}: Props) {
  const nivel: 'nordeste' | 'uf' = estadoFilter ? 'uf' : 'nordeste'
  const ufCode =
    estadoFilter && isInsightsUfNordeste(estadoFilter)
      ? UF_CODES[estadoFilter.toUpperCase()]
      : undefined

  const [geoUf, setGeoUf] = useState<FeatureCollection | null>(null)
  const [geoMun, setGeoMun] = useState<FeatureCollection | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [hoverUf, setHoverUf] = useState<string | null>(null)
  const [hoverCidade, setHoverCidade] = useState<string | null>(null)

  const estadosPresentes = useMemo(
    () =>
      [
        ...new Set(
          cidades
            .map((c) => c.estado)
            .filter((uf): uf is string => Boolean(uf) && isInsightsUfNordeste(uf))
        ),
      ],
    [cidades]
  )
  const ibgeQ = useInsightsIbgeMeta(
    nivel === 'uf' && estadoFilter ? [estadoFilter] : estadosPresentes,
    cidades.length > 0
  )

  const popMap = useMemo(() => {
    const m = new Map<string, number>()
    for (const [k, meta] of ibgeQ.data?.byKey ?? []) m.set(k, meta.populacao)
    return m
  }, [ibgeQ.data])

  const perCapita = useMemo(
    () => enriquecerCidadesPerCapita(cidades, popMap),
    [cidades, popMap]
  )

  const perCapitaByCodigo = useMemo(() => {
    const m = new Map<number, CidadePerCapita & { codigo_ibge: number }>()
    for (const c of perCapita) {
      const meta = lookupIbgeMeta(ibgeQ.data?.byKey, c.cidade, c.estado)
      if (!meta) continue
      m.set(meta.codigo_ibge, { ...c, codigo_ibge: meta.codigo_ibge })
    }
    return m
  }, [perCapita, ibgeQ.data])

  const cidadeByCodigo = useMemo(() => {
    const m = new Map<number, InsightsCidadeRow>()
    for (const c of cidades) {
      const meta = lookupIbgeMeta(ibgeQ.data?.byKey, c.cidade, c.estado)
      if (meta) m.set(meta.codigo_ibge, c)
    }
    return m
  }, [cidades, ibgeQ.data])

  // Malha Nordeste (UF) — filtra a malha nacional para o escopo do produto
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(IBGE_UF_MALHA)
        if (!res.ok) throw new Error(`Malha IBGE UF: ${res.status}`)
        const json = (await res.json()) as FeatureCollection
        if (!cancelled) setGeoUf(filterGeoNordeste(json))
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Falha ao carregar mapa')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Malha municípios ao entrar na UF
  useEffect(() => {
    if (!ufCode || nivel !== 'uf') {
      setGeoMun(null)
      return
    }
    let cancelled = false
    setGeoMun(null)
    ;(async () => {
      try {
        const res = await fetch(ibgeMunicipiosMalha(ufCode))
        if (!res.ok) throw new Error(`Malha municípios: ${res.status}`)
        const json = (await res.json()) as FeatureCollection
        if (!cancelled) {
          setGeoMun(json)
          setError(null)
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Falha ao carregar municípios')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [ufCode, nivel])

  const byUf = useMemo(() => {
    const m = new Map<string, UfAgg>()
    for (const c of cidades) {
      const uf = (c.estado ?? '').trim().toUpperCase()
      if (!isInsightsUfNordeste(uf)) continue
      const prev = m.get(uf) ?? { uf, fat: 0, cidades: 0, clientes: 0 }
      prev.fat += c.faturamento_total
      prev.cidades += 1
      prev.clientes += c.total_clientes
      m.set(uf, prev)
    }
    return m
  }, [cidades])

  const fatTotal = useMemo(
    () => [...byUf.values()].reduce((s, u) => s + u.fat, 0),
    [byUf]
  )
  const maxFatUf = useMemo(
    () => Math.max(0, ...[...byUf.values()].map((u) => u.fat)),
    [byUf]
  )

  const cidadesNaUf = useMemo(
    () =>
      estadoFilter
        ? cidades.filter((c) => c.estado?.toUpperCase() === estadoFilter.toUpperCase())
        : [],
    [cidades, estadoFilter]
  )

  const maxFatPc = useMemo(
    () =>
      Math.max(
        0,
        ...perCapita
          .filter((c) => !estadoFilter || c.estado === estadoFilter)
          .map((c) => c.faturamento_per_capita)
      ),
    [perCapita, estadoFilter]
  )

  const styleUf = (feature?: Feature<Geometry, { codarea?: string }>): PathOptions => {
    const code = String(feature?.properties?.codarea ?? '')
    const uf = CODE_TO_UF[code] ?? ''
    const agg = byUf.get(uf)
    const pct = fatTotal > 0 && agg ? agg.fat / fatTotal : 0
    const selected = !!estadoFilter && estadoFilter === uf
    return {
      fillColor: fatColor(pct, selected),
      weight: selected ? 2.5 : 1,
      color: selected ? 'oklch(0.4 0.1 200)' : 'oklch(0.75 0.02 220)',
      fillOpacity: agg ? 0.85 : 0.35,
    }
  }

  const munPathStyle = (
    codigo: number,
    opts: { selected?: boolean; hovered?: boolean } = {}
  ): PathOptions => {
    const cidade = cidadeByCodigo.get(codigo)
    const fatPc = perCapitaByCodigo.get(codigo)?.faturamento_per_capita ?? 0
    const { selected = false, hovered = false } = opts
    return {
      fillColor: cidade ? perCapitaFill(fatPc, maxFatPc) : 'oklch(0.96 0.005 220)',
      weight: selected || hovered ? 2.2 : 0.6,
      color: selected
        ? 'oklch(0.4 0.12 200)'
        : hovered
          ? 'oklch(0.5 0.1 200)'
          : 'oklch(0.75 0.02 220)',
      fillOpacity: cidade ? (selected ? 0.92 : 0.82) : 0.1,
    }
  }

  const styleMun = (feature?: Feature<Geometry, { codarea?: string }>): PathOptions => {
    const codigo = Number(feature?.properties?.codarea)
    const cidade = cidadeByCodigo.get(codigo)
    const selected =
      !!cidade &&
      cidadeFilter.trim().toLowerCase() === cidade.cidade.trim().toLowerCase()
    return munPathStyle(codigo, { selected })
  }

  const onEachUf = (feature: Feature<Geometry, { codarea?: string }>, layer: Layer) => {
    const code = String(feature.properties?.codarea ?? '')
    const uf = CODE_TO_UF[code]
    if (!uf || !isInsightsUfNordeste(uf)) return
    const agg = byUf.get(uf)
    const share = fatTotal > 0 && agg ? (agg.fat / fatTotal) * 100 : 0
    layer.bindTooltip(
      `<strong>${uf}</strong><br/>${
        agg
          ? `${formatCurrency(agg.fat)} · ${share.toFixed(1)}%<br/>${agg.cidades} cidades · ${agg.clientes.toLocaleString('pt-BR')} clientes`
          : 'Sem sell-out no filtro'
      }`,
      { sticky: true }
    )
    layer.on({
      mouseover: () => setHoverUf(uf),
      mouseout: () => setHoverUf(null),
      click: () => onSelectUf(uf),
    })
  }

  const onEachMun = (feature: Feature<Geometry, { codarea?: string }>, layer: Layer) => {
    const codigo = Number(feature.properties?.codarea)
    const cidade = cidadeByCodigo.get(codigo)
    const pc = perCapitaByCodigo.get(codigo)
    const metaIbge = ibgeQ.data?.byCodigo.get(codigo)
    const nome = cidade?.cidade ?? (metaIbge ? titleCaseMunicipio(metaIbge.cidade_norm) : null)
    const ufLabel = cidade?.estado ?? metaIbge?.estado ?? estadoFilter
    layer.bindTooltip(
      `<strong>${nome ?? 'Município'}${ufLabel ? ` / ${ufLabel}` : ''}</strong><br/>${
        cidade
          ? `${formatCurrency(cidade.faturamento_total)} · ${cidade.total_clientes} clientes${
              pc ? `<br/>${formatPerCapitaCurrency(pc.faturamento_per_capita)} / hab` : ''
            }<br/><span style="opacity:.7">Clique de novo para voltar ao Nordeste</span>`
          : 'Sem sell-out Insights'
      }`,
      { sticky: true }
    )
    if (cidade) {
      const selected =
        cidadeFilter.trim().toLowerCase() === cidade.cidade.trim().toLowerCase()
      const path = layer as Layer & { setStyle?: (s: PathOptions) => void }
      layer.on({
        mouseover: () => {
          setHoverCidade(cidadeUfKey(cidade.cidade, cidade.estado))
          path.setStyle?.(munPathStyle(codigo, { selected, hovered: true }))
        },
        mouseout: () => {
          setHoverCidade(null)
          path.setStyle?.(munPathStyle(codigo, { selected, hovered: false }))
        },
        click: () => onSelectCidade(cidade.cidade, cidade.estado),
      })
    } else {
      // Município sem sell-out: clique volta ao Nordeste
      layer.on({
        click: () => onSelectUf(''),
      })
    }
  }

  const ranking = useMemo(() => {
    if (nivel === 'uf') {
      return [...perCapita]
        .filter((c) => c.estado === estadoFilter)
        .sort((a, b) => b.faturamento_per_capita - a.faturamento_per_capita)
        .slice(0, 10)
        .map((c, idx) => ({
          key: cidadeUfKey(c.cidade, c.estado),
          rank: idx + 1,
          label: c.cidade,
          sub: formatPerCapitaCurrency(c.faturamento_per_capita),
          meta: `${formatCurrency(c.faturamento_total)} · ${c.total_clientes} clientes`,
          active:
            cidadeFilter.trim().toLowerCase() === c.cidade.trim().toLowerCase(),
          onClick: () => onSelectCidade(c.cidade, c.estado),
        }))
    }
    return INSIGHTS_UFS_NORDESTE.map((uf) => {
      const u = byUf.get(uf) ?? { uf, fat: 0, cidades: 0, clientes: 0 }
      return u
    })
      .sort((a, b) => b.fat - a.fat || a.uf.localeCompare(b.uf))
      .map((u, idx) => ({
        key: u.uf,
        rank: idx + 1,
        label: u.uf,
        sub: `${fatTotal > 0 ? ((u.fat / fatTotal) * 100).toFixed(0) : 0}%`,
        meta: formatCurrency(u.fat),
        active: estadoFilter === u.uf,
        onClick: () => onSelectUf(u.uf),
      }))
  }, [
    nivel,
    perCapita,
    estadoFilter,
    cidadeFilter,
    byUf,
    fatTotal,
    onSelectCidade,
    onSelectUf,
  ])

  const activeLabel =
    hoverCidade?.split('\t')[0] ??
    hoverUf ??
    (nivel === 'uf' ? estadoFilter : null)

  const geoAtivo = nivel === 'uf' ? geoMun : geoUf
  const loadingMun = nivel === 'uf' && !geoMun && !error

  return (
    <div className={cn('mb-6 space-y-4', className)}>
      <div className="relative overflow-hidden rounded-lg border border-border/60 bg-muted/20">
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-border/50">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <MapIcon className="w-3.5 h-3.5" />
            {nivel === 'nordeste'
              ? 'Nordeste · faturamento por UF'
              : `${estadoFilter} · faturamento / habitante`}
          </p>
          <div className="text-[11px] text-muted-foreground flex items-center gap-2">
            {nivel === 'uf' ? (
              <button
                type="button"
                className="inline-flex items-center gap-1 font-medium text-foreground hover:underline underline-offset-2"
                onClick={() => onSelectUf('')}
              >
                <ArrowLeft className="w-3 h-3" />
                Nordeste
              </button>
            ) : (
              <span>Clique no estado · ⌘/Ctrl + scroll para zoom</span>
            )}
          </div>
        </div>

        {nivel === 'uf' && (
          <div className="flex flex-wrap items-center gap-3 px-3 py-1.5 border-b border-border/40 text-[10px] text-muted-foreground">
            <span>Cor do município = fat. / habitante</span>
            <span className="inline-flex items-center gap-1" aria-hidden>
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[oklch(0.9_0.03_200)]" />
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[oklch(0.72_0.09_200)]" />
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[oklch(0.52_0.14_200)]" />
              <span className="ml-0.5">menor → maior</span>
            </span>
          </div>
        )}

        <div className="h-[400px] w-full">
          {error && (
            <div className="flex h-full items-center justify-center text-sm text-destructive px-4 text-center">
              {error}
            </div>
          )}
          {!error && ((!geoUf && nivel === 'nordeste') || loadingMun) && (
            <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              {loadingMun ? `Carregando municípios de ${estadoFilter}…` : 'Carregando malha do Nordeste…'}
            </div>
          )}
          {geoAtivo && (
            <MapContainer
              key={nivel === 'uf' ? `uf-${estadoFilter}` : 'nordeste'}
              center={MAP_CENTER_NORDESTE}
              zoom={nivel === 'uf' ? 7 : MAP_ZOOM_NORDESTE}
              zoomSnap={0.25}
              className="h-full w-full z-0"
              zoomControl={nivel === 'uf'}
              attributionControl={false}
              scrollWheelZoom={false}
            >
              <CmdScrollZoom />
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
                attribution="&copy; OSM &copy; CARTO"
              />
              <FitGeo
                geo={geoAtivo}
                maxZoom={nivel === 'uf' ? 9 : 5.5}
                padding={nivel === 'uf' ? 24 : 28}
                fixedBounds={nivel === 'nordeste' ? NE_BOUNDS : undefined}
              />
              {nivel === 'nordeste' && geoUf && (
                <GeoJSON
                  key={`uf-${cidades.length}-${maxFatUf}`}
                  data={geoUf}
                  style={styleUf as never}
                  onEachFeature={onEachUf as never}
                />
              )}
              {nivel === 'uf' && geoMun && (
                <GeoJSON
                  key={`mun-${estadoFilter}-${cidadesNaUf.length}-${maxFatPc}-${cidadeFilter}`}
                  data={geoMun}
                  style={styleMun as never}
                  onEachFeature={onEachMun as never}
                />
              )}
            </MapContainer>
          )}
        </div>
      </div>

      <aside className="rounded-lg border border-border/60 bg-card p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {nivel === 'uf' ? `Top fat./hab · ${estadoFilter}` : 'Ranking UF · Nordeste'}
          </p>
          {activeLabel && (
            <p className="text-xs text-muted-foreground">
              Destaque: <span className="font-medium text-foreground">{activeLabel}</span>
            </p>
          )}
        </div>
        <ul className="grid grid-cols-3 gap-1">
          {ranking.map((row) => {
            const active =
              row.active ||
              (nivel === 'uf' && hoverCidade === row.key) ||
              (nivel === 'nordeste' && hoverUf === row.label)
            return (
              <li key={row.key}>
                <button
                  type="button"
                  onClick={row.onClick}
                  title={
                    row.active
                      ? 'Clique de novo para voltar ao Nordeste'
                      : undefined
                  }
                  className={cn(
                    'flex w-full items-start gap-2 rounded-md px-2 py-2 text-left transition-colors',
                    active ? 'bg-muted/60' : 'hover:bg-muted/40'
                  )}
                >
                  <span className="w-5 shrink-0 font-mono text-xs tabular-nums text-muted-foreground pt-0.5">
                    {String(row.rank).padStart(2, '0')}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">
                      {row.label}
                      {nivel === 'nordeste' ? null : (
                        <span className="ml-1 text-[10px] uppercase text-muted-foreground">
                          {estadoFilter}
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                      <span className="font-medium text-teal">{row.sub}</span>
                      <span className="mx-1 opacity-40">·</span>
                      {row.meta}
                    </p>
                  </div>
                </button>
              </li>
            )
          })}
          {ranking.length === 0 && (
            <li className="col-span-full text-xs text-muted-foreground py-6 text-center">
              {nivel === 'uf'
                ? 'Sem população IBGE para per capita neste estado.'
                : 'Sem dados no filtro.'}
            </li>
          )}
        </ul>
      </aside>
    </div>
  )
}
