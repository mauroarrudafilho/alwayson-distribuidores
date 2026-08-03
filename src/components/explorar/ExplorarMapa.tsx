import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CircleMarker, MapContainer, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { PdvMapaPonto } from '@/types/pdv'
import {
  faixaRelevanciaLabel,
  formatIndiceRelevancia,
  raioMapaAbsoluto,
} from '@/lib/pdv'
import {
  PDV_SEGMENTO_OUTROS,
  PDV_SEGMENTOS_CNAE,
  segmentoCnaePorCodigo,
  type PdvSegmentoCnaeId,
} from '@/lib/pdvCnaeSegmento'
import { formatCnpj } from '@/lib/format'
import { cn } from '@/lib/utils'

const PETROLINA_CENTER: [number, number] = [-9.39, -40.5]

type CoberturaFiltro = 'todos' | 'nao_atendido' | 'carteira'
type FaixaFiltro = 'todos' | 'A' | 'B' | 'C' | 'D' | 'ab'

const MIN_RELEVANCIA_OPCOES = [
  { value: 0, label: 'Todas' },
  { value: 30, label: '≥ 30' },
  { value: 50, label: '≥ 50' },
  { value: 70, label: '≥ 70' },
] as const

function FitPontos({ pontos }: { pontos: PdvMapaPonto[] }) {
  const map = useMap()
  useEffect(() => {
    if (!pontos.length) {
      map.setView(PETROLINA_CENTER, 12)
      return
    }
    const bounds = L.latLngBounds(pontos.map((p) => [p.latitude, p.longitude] as [number, number]))
    map.fitBounds(bounds.pad(0.08), { maxZoom: 14 })
  }, [map, pontos])
  return null
}

function LegendaTamanho() {
  const amostras = [
    { indice: 30, caption: 'típico' },
    { indice: 55, caption: 'médio' },
    { indice: 80, caption: 'forte' },
  ] as const
  return (
    <div className="space-y-1">
      <p className="text-[11px] text-muted-foreground">
        <span className="font-medium text-foreground/85">Tamanho</span>
        {' — '}
        índice de consolidação (0–100): rede de lojas + tempo de operação. Não é faturamento; só
        destaca PDVs com maior probabilidade de estar consolidados na praça.
      </p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        {amostras.map((a) => {
          const d = raioMapaAbsoluto(a.indice) * 2
          return (
            <span key={a.indice} className="inline-flex items-center gap-1.5">
              <span
                className="inline-block shrink-0 rounded-full border border-muted-foreground/25 bg-muted-foreground/30"
                style={{ width: d, height: d }}
              />
              <span>
                {a.indice}/100
                <span className="text-muted-foreground/75"> ({a.caption})</span>
              </span>
            </span>
          )
        })}
      </div>
    </div>
  )
}

function PontoPopupContent({ p, segLabel }: { p: PdvMapaPonto; segLabel: string }) {
  return (
    <div className="text-xs leading-snug">
      <p className="font-medium">{p.nome}</p>
      <p>{p.segmento_cnae ?? segLabel}</p>
      <p>
        Relevância {formatIndiceRelevancia(p.indice_relevancia)}
        {p.faixa ? ` · ${faixaRelevanciaLabel(p.faixa)}` : ''}
      </p>
      <p className="text-muted-foreground">{formatCnpj(p.cnpj)}</p>
      {p.bairro && <p className="text-muted-foreground">{p.bairro}</p>}
      {p.qtd_lojas_rede != null && p.qtd_lojas_rede > 1 && (
        <p className="text-muted-foreground">{p.qtd_lojas_rede} lojas na rede</p>
      )}
      {p.atendido && p.cliente_id ? (
        <Link
          to={`/clientes/${p.cliente_id}`}
          className="mt-2 inline-block font-medium text-teal hover:underline"
        >
          Ver ficha na carteira →
        </Link>
      ) : (
        <p className="mt-1 text-muted-foreground">Não atendido</p>
      )}
    </div>
  )
}

function passaFaixa(faixa: string | null | undefined, filtro: FaixaFiltro): boolean {
  if (filtro === 'todos') return true
  if (!faixa) return false
  if (filtro === 'ab') return faixa === 'A' || faixa === 'B'
  return faixa === filtro
}

type Props = {
  pontos: PdvMapaPonto[]
  className?: string
}

export function ExplorarMapa({ pontos, className }: Props) {
  const todosSegmentos = useMemo(
    () => new Set<PdvSegmentoCnaeId>([...PDV_SEGMENTOS_CNAE.map((s) => s.id), 'outros']),
    []
  )
  const [segmentosAtivos, setSegmentosAtivos] = useState<Set<PdvSegmentoCnaeId>>(todosSegmentos)
  const [cobertura, setCobertura] = useState<CoberturaFiltro>('todos')
  const [faixaFiltro, setFaixaFiltro] = useState<FaixaFiltro>('todos')
  const [minRelevancia, setMinRelevancia] = useState(0)

  const legenda = useMemo(() => {
    const segCounts = new Map<PdvSegmentoCnaeId, number>()
    for (const p of pontos) {
      const id = segmentoCnaePorCodigo(p.cnae_principal).id
      segCounts.set(id, (segCounts.get(id) ?? 0) + 1)
    }
    const items = PDV_SEGMENTOS_CNAE.map((s) => ({
      ...s,
      count: segCounts.get(s.id) ?? 0,
    })).filter((s) => s.count > 0)
    const outrosCount = segCounts.get('outros') ?? 0
    if (outrosCount > 0) {
      items.push({ ...PDV_SEGMENTO_OUTROS, count: outrosCount })
    }
    return items
  }, [pontos])

  const filtrados = useMemo(() => {
    return pontos.filter((p) => {
      const seg = segmentoCnaePorCodigo(p.cnae_principal)
      if (!segmentosAtivos.has(seg.id)) return false
      if (cobertura === 'carteira' && !p.atendido) return false
      if (cobertura === 'nao_atendido' && p.atendido) return false
      if (p.indice_relevancia < minRelevancia) return false
      if (!passaFaixa(p.faixa, faixaFiltro)) return false
      return true
    })
  }, [pontos, segmentosAtivos, cobertura, minRelevancia, faixaFiltro])

  /** Carteira por cima — melhor leitura quando há sobreposição. */
  const ordenados = useMemo(
    () => [...filtrados].sort((a, b) => Number(a.atendido) - Number(b.atendido)),
    [filtrados]
  )

  const toggleSegmento = (id: PdvSegmentoCnaeId) => {
    setSegmentosAtivos((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        if (next.size > 1) next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const atendidosVisiveis = filtrados.filter((p) => p.atendido).length
  const naoAtendidosVisiveis = filtrados.length - atendidosVisiveis

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Cobertura
        </span>
        {(
          [
            ['todos', 'Todos'],
            ['nao_atendido', 'Não atendidos'],
            ['carteira', 'Na carteira'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setCobertura(id)}
            className={cn(
              'rounded-full border px-2.5 py-0.5 text-[11px] transition-colors',
              cobertura === id
                ? 'border-navy/40 bg-navy text-white'
                : 'border-border/70 bg-background text-muted-foreground hover:border-border'
            )}
          >
            {label}
          </button>
        ))}
        <span className="ml-auto text-[11px] tabular-nums text-muted-foreground">
          {filtrados.length.toLocaleString('pt-BR')} pontos
          {naoAtendidosVisiveis > 0 && cobertura !== 'carteira' && (
            <span className="text-muted-foreground/80">
              {' '}
              · {naoAtendidosVisiveis.toLocaleString('pt-BR')} oportunidade
            </span>
          )}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Faixa
        </span>
        {(
          [
            ['todos', 'Todas'],
            ['ab', 'A+B'],
            ['A', 'A'],
            ['B', 'B'],
            ['C', 'C'],
            ['D', 'D'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFaixaFiltro(id)}
            className={cn(
              'rounded-full border px-2.5 py-0.5 text-[11px] transition-colors',
              faixaFiltro === id
                ? 'border-teal/50 bg-teal text-white'
                : 'border-border/70 bg-background text-muted-foreground hover:border-border'
            )}
          >
            {label}
          </button>
        ))}
        <span className="mx-1 hidden h-4 w-px bg-border/70 sm:inline-block" />
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Relevância
        </span>
        {MIN_RELEVANCIA_OPCOES.map((op) => (
          <button
            key={op.value}
            type="button"
            onClick={() => setMinRelevancia(op.value)}
            className={cn(
              'rounded-full border px-2.5 py-0.5 text-[11px] transition-colors',
              minRelevancia === op.value
                ? 'border-teal/50 bg-teal text-white'
                : 'border-border/70 bg-background text-muted-foreground hover:border-border'
            )}
          >
            {op.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {legenda.map((s) => {
          const on = segmentosAtivos.has(s.id)
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => toggleSegmento(s.id)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] transition-opacity',
                on ? 'opacity-100' : 'opacity-40'
              )}
              style={{ borderColor: s.stroke }}
            >
              <span
                className="h-2.5 w-2.5 rounded-full border"
                style={{ backgroundColor: s.fill, borderColor: s.stroke }}
              />
              {s.label} ({s.count})
            </button>
          )
        })}
        {atendidosVisiveis > 0 && (
          <span className="inline-flex items-center gap-1.5 px-1 text-[11px] text-muted-foreground">
            <span className="h-2.5 w-2.5 rounded-full border-2 border-teal bg-transparent" />
            Carteira ({atendidosVisiveis})
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <LegendaTamanho />
        <p className="shrink-0 text-[11px] text-muted-foreground sm:max-w-[14rem] sm:text-right">
          Cor = segmento CNAE · contorno teal = na carteira · clique no ponto para detalhes
        </p>
      </div>

      <div className="h-[min(52vh,520px)] overflow-hidden rounded-lg border border-border/70">
        {filtrados.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-1 text-sm text-muted-foreground">
            <p>Nenhum ponto com os filtros atuais.</p>
            <button
              type="button"
              className="text-xs text-teal underline-offset-2 hover:underline"
              onClick={() => {
                setCobertura('todos')
                setFaixaFiltro('todos')
                setMinRelevancia(0)
                setSegmentosAtivos(todosSegmentos)
              }}
            >
              Limpar filtros
            </button>
          </div>
        ) : (
          <MapContainer
            center={PETROLINA_CENTER}
            zoom={12}
            className="h-full w-full"
            scrollWheelZoom
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <FitPontos pontos={filtrados} />
            {ordenados.map((p) => {
              const seg = segmentoCnaePorCodigo(p.cnae_principal)
              const r = raioMapaAbsoluto(p.indice_relevancia)
              return (
                <CircleMarker
                  key={p.cnpj}
                  center={[p.latitude, p.longitude]}
                  radius={r}
                  pathOptions={{
                    color: p.atendido ? '#0f766e' : seg.stroke,
                    fillColor: seg.fill,
                    fillOpacity: p.atendido ? 0.88 : 0.72,
                    weight: p.atendido ? 2.5 : 1,
                  }}
                >
                  <Tooltip direction="top" opacity={0.92}>
                    <span className="text-xs font-medium">{p.nome}</span>
                  </Tooltip>
                  <Popup closeButton minWidth={220} maxWidth={280}>
                    <PontoPopupContent p={p} segLabel={seg.label} />
                  </Popup>
                </CircleMarker>
              )
            })}
          </MapContainer>
        )}
      </div>
    </div>
  )
}
