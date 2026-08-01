import { useEffect, useMemo, useState } from 'react'
import L from 'leaflet'
import { GeoJSON, MapContainer, TileLayer, useMap } from 'react-leaflet'
import type { Feature, FeatureCollection, Geometry } from 'geojson'
import type { Layer, PathOptions } from 'leaflet'
import { Loader2, Map as MapIcon } from 'lucide-react'
import 'leaflet/dist/leaflet.css'
import { formatCurrency } from '@/lib/format'
import { UF_CODES } from '@/lib/ibge-populacao'
import {
  INSIGHTS_UF_CODES_NORDESTE,
  INSIGHTS_UFS_NORDESTE,
  isInsightsUfNordeste,
} from '@/lib/insights-territorio'
import { cn } from '@/lib/utils'

const IBGE_UF_MALHA =
  'https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=UF'

const NE_UF_CODE_SET = new Set(
  Object.values(INSIGHTS_UF_CODES_NORDESTE).map((c) => String(c))
)

const MAP_CENTER_NORDESTE: [number, number] = [-9.0, -40.5]
const MAP_ZOOM_NORDESTE = 5
const NE_BOUNDS: [[number, number], [number, number]] = [
  [-18.2, -48.2],
  [-1.2, -34.5],
]

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

function fatColor(pct: number, selected: boolean): string {
  if (selected) return 'oklch(0.52 0.12 200)'
  if (pct <= 0) return 'oklch(0.92 0.01 220)'
  if (pct < 0.05) return 'oklch(0.88 0.04 200)'
  if (pct < 0.1) return 'oklch(0.78 0.07 200)'
  if (pct < 0.2) return 'oklch(0.68 0.1 200)'
  return 'oklch(0.58 0.13 200)'
}

function CmdScrollZoom() {
  const map = useMap()
  useEffect(() => {
    const el = map.getContainer()
    const onWheel = (e: WheelEvent) => {
      if (!e.metaKey && !e.ctrlKey) return
      e.preventDefault()
      e.stopPropagation()
      const step = map.options.zoomSnap || 0.25
      map.setZoom(map.getZoom() - Math.sign(e.deltaY) * step)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [map])
  return null
}

function FitNordeste({ geo }: { geo: FeatureCollection | null }) {
  const map = useMap()
  useEffect(() => {
    if (!geo?.features?.length) return
    const t = window.setTimeout(() => {
      map.invalidateSize()
      map.fitBounds(L.latLngBounds(NE_BOUNDS), { padding: [28, 28], maxZoom: 5.5 })
    }, 40)
    return () => window.clearTimeout(t)
  }, [map, geo])
  return null
}

export type ProdutoUfAgg = {
  estado: string
  faturamento_total: number
  total_clientes: number
  total_cidades: number
}

type Props = {
  porUf: ProdutoUfAgg[]
  fatSku: number
  /** UF selecionada para filtrar a tabela de cidades (toggle). */
  selectedUf?: string
  onSelectUf?: (uf: string) => void
  className?: string
}

/** Choropleth Nordeste do sell-out do SKU — clique na UF filtra a leitura. */
export function InsightsProdutoUfMap({
  porUf,
  fatSku,
  selectedUf = '',
  onSelectUf,
  className,
}: Props) {
  const [geoUf, setGeoUf] = useState<FeatureCollection | null>(null)
  const [error, setError] = useState<string | null>(null)

  const byUf = useMemo(() => {
    const m = new Map<string, ProdutoUfAgg>()
    for (const u of porUf) {
      const uf = u.estado.trim().toUpperCase()
      if (!isInsightsUfNordeste(uf)) continue
      m.set(uf, { ...u, estado: uf })
    }
    return m
  }, [porUf])

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

  const styleUf = (feature?: Feature<Geometry, { codarea?: string }>): PathOptions => {
    const code = String(feature?.properties?.codarea ?? '')
    const uf = CODE_TO_UF[code] ?? ''
    const agg = byUf.get(uf)
    const pct = fatSku > 0 && agg ? agg.faturamento_total / fatSku : 0
    const selected = !!selectedUf && selectedUf === uf
    return {
      fillColor: fatColor(pct, selected),
      weight: selected ? 2.5 : 1,
      color: selected ? 'oklch(0.4 0.1 200)' : 'oklch(0.75 0.02 220)',
      fillOpacity: agg ? 0.85 : 0.35,
    }
  }

  const onEachUf = (feature: Feature<Geometry, { codarea?: string }>, layer: Layer) => {
    const code = String(feature.properties?.codarea ?? '')
    const uf = CODE_TO_UF[code]
    if (!uf || !isInsightsUfNordeste(uf)) return
    const agg = byUf.get(uf)
    const share = fatSku > 0 && agg ? (agg.faturamento_total / fatSku) * 100 : 0
    layer.bindTooltip(
      `<strong>${uf}</strong><br/>${
        agg
          ? `${formatCurrency(agg.faturamento_total)} · ${share.toFixed(1)}% do SKU<br/>${agg.total_cidades} cidades · ${agg.total_clientes.toLocaleString('pt-BR')} clientes`
          : 'Sem sell-out deste SKU'
      }`,
      { sticky: true }
    )
    layer.on({
      click: () => {
        if (!onSelectUf) return
        onSelectUf(selectedUf === uf ? '' : uf)
      },
    })
  }

  const ranking = useMemo(
    () =>
      INSIGHTS_UFS_NORDESTE.map((uf) => {
        const u = byUf.get(uf)
        return {
          uf,
          fat: u?.faturamento_total ?? 0,
          clientes: u?.total_clientes ?? 0,
        }
      }).sort((a, b) => b.fat - a.fat || a.uf.localeCompare(b.uf)),
    [byUf]
  )

  return (
    <div className={cn('overflow-hidden rounded-lg border border-border/60 bg-muted/20', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 px-3 py-2">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <MapIcon className="h-3.5 w-3.5" />
          Mix por UF · Nordeste
        </p>
        <p className="text-[11px] text-muted-foreground">
          {selectedUf ? (
            <button
              type="button"
              className="font-medium text-foreground underline-offset-2 hover:underline"
              onClick={() => onSelectUf?.('')}
            >
              Filtrando {selectedUf} · limpar
            </button>
          ) : (
            'Clique na UF para filtrar cidades'
          )}
        </p>
      </div>

      <div className="h-[300px] w-full">
        {error && (
          <div className="flex h-full items-center justify-center px-4 text-center text-sm text-destructive">
            {error}
          </div>
        )}
        {!error && !geoUf && (
          <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando malha…
          </div>
        )}
        {geoUf && (
          <MapContainer
            center={MAP_CENTER_NORDESTE}
            zoom={MAP_ZOOM_NORDESTE}
            zoomSnap={0.25}
            className="z-0 h-full w-full"
            zoomControl={false}
            attributionControl={false}
            scrollWheelZoom={false}
          >
            <CmdScrollZoom />
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
              attribution="&copy; OSM &copy; CARTO"
            />
            <FitNordeste geo={geoUf} />
            <GeoJSON
              key={`sku-uf-${porUf.length}-${selectedUf}-${fatSku}`}
              data={geoUf}
              style={styleUf as never}
              onEachFeature={onEachUf as never}
            />
          </MapContainer>
        )}
      </div>

      <ul className="grid grid-cols-3 gap-1 border-t border-border/50 p-2 sm:grid-cols-5">
        {ranking.slice(0, 5).map((r, idx) => {
          const pct = fatSku > 0 ? (r.fat / fatSku) * 100 : 0
          const active = selectedUf === r.uf
          return (
            <li key={r.uf}>
              <button
                type="button"
                onClick={() => onSelectUf?.(active ? '' : r.uf)}
                className={cn(
                  'flex w-full flex-col rounded-md px-2 py-1.5 text-left transition-colors',
                  active ? 'bg-muted/70' : 'hover:bg-muted/40'
                )}
              >
                <span className="text-[10px] text-muted-foreground">
                  {String(idx + 1).padStart(2, '0')} · {r.uf}
                </span>
                <span className="text-xs font-medium tabular-nums text-teal">
                  {pct.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
