import { useEffect, useMemo, useRef } from 'react'
import { CircleMarker, MapContainer, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { PdvCoberturaDetalheRow } from '@/types/pdv'
import { geoConfiavelMapa, pdvPlotavelMapa, raioMapaAbsoluto } from '@/lib/pdv'
import { segmentoCnaePorCodigo } from '@/lib/pdvCnaeSegmento'

const FALLBACK_CENTER: [number, number] = [-9.39, -40.5]
const HIGHLIGHT_STROKE = '#0d9488'

function FitPontos({ pontos }: { pontos: PdvCoberturaDetalheRow[] }) {
  const map = useMap()
  const fittedKey = useRef<string>('')

  useEffect(() => {
    if (!pontos.length) {
      map.setView(FALLBACK_CENTER, 13)
      return
    }
    const key = pontos.map((p) => p.cnpj).join(',')
    if (key === fittedKey.current) return
    fittedKey.current = key
    const bounds = L.latLngBounds(
      pontos.map((p) => [p.latitude!, p.longitude!] as [number, number])
    )
    map.fitBounds(bounds.pad(0.12), { maxZoom: 16 })
  }, [map, pontos])

  return null
}

function FlyToSelected({
  pontos,
  selectedCnpj,
}: {
  pontos: PdvCoberturaDetalheRow[]
  selectedCnpj: string | null
}) {
  const map = useMap()

  useEffect(() => {
    if (!selectedCnpj) return
    const p = pontos.find((x) => x.cnpj === selectedCnpj)
    if (p?.geo_mapa && p.latitude != null && p.longitude != null) {
      map.flyTo([p.latitude, p.longitude], Math.max(map.getZoom(), 16), { duration: 0.35 })
    }
  }, [map, pontos, selectedCnpj])

  return null
}

function DetalheMarker({
  p,
  selected,
  dimmed,
  onSelect,
}: {
  p: PdvCoberturaDetalheRow
  selected: boolean
  dimmed: boolean
  onSelect: (cnpj: string) => void
}) {
  const seg = segmentoCnaePorCodigo(p.cnae_principal)
  const baseR = raioMapaAbsoluto(p.indice_relevancia, { minRaio: 3, maxRaio: 12 })
  const center: [number, number] = [p.latitude!, p.longitude!]
  const confiavel = geoConfiavelMapa(p.nivel_geocodificacao)

  const pathOptions = useMemo(
    () => ({
      color: selected ? HIGHLIGHT_STROKE : p.atendido ? '#0f766e' : seg.stroke,
      fillColor: selected ? HIGHLIGHT_STROKE : seg.fill,
      fillOpacity: selected ? 0.92 : dimmed ? 0.3 : confiavel ? (p.atendido ? 0.88 : 0.72) : 0.45,
      weight: selected ? 4 : confiavel ? (p.atendido ? 2.5 : 1) : 1.5,
      opacity: dimmed ? 0.4 : confiavel ? 1 : 0.65,
      dashArray: confiavel ? undefined : '4 3',
    }),
    [selected, dimmed, p.atendido, seg.stroke, seg.fill, confiavel]
  )

  return (
    <>
      {selected && (
        <CircleMarker
          key={`${p.cnpj}-halo`}
          center={center}
          radius={baseR + 12}
          pathOptions={{
            color: HIGHLIGHT_STROKE,
            fillColor: HIGHLIGHT_STROKE,
            fillOpacity: 0.18,
            weight: 2.5,
            opacity: 0.95,
          }}
          interactive={false}
        />
      )}
      <CircleMarker
        key={`${p.cnpj}-${selected ? 'on' : 'off'}`}
        center={center}
        radius={selected ? baseR + 4 : baseR}
        pathOptions={pathOptions}
        eventHandlers={{
          click: (e) => {
            L.DomEvent.stopPropagation(e)
            onSelect(p.cnpj)
          },
        }}
      />
    </>
  )
}

type Props = {
  pontos: PdvCoberturaDetalheRow[]
  selectedCnpj: string | null
  onSelect: (cnpj: string) => void
  className?: string
}

export function ExplorarCoberturaDetalheMap({ pontos, selectedCnpj, onSelect, className }: Props) {
  const comGeo = useMemo(
    () =>
      pontos.filter((p) =>
        pdvPlotavelMapa(p.latitude, p.longitude, p.nivel_geocodificacao)
      ),
    [pontos]
  )

  const selectedRow = selectedCnpj ? pontos.find((p) => p.cnpj === selectedCnpj) : undefined
  const selectedSemGeo = selectedRow != null && !selectedRow.geo_mapa

  const { outros, selecionado } = useMemo(() => {
    const sel = selectedCnpj ? comGeo.find((p) => p.cnpj === selectedCnpj) : undefined
    const rest = selectedCnpj ? comGeo.filter((p) => p.cnpj !== selectedCnpj) : comGeo
    return { outros: rest, selecionado: sel }
  }, [comGeo, selectedCnpj])

  const semGeoCount = pontos.length - comGeo.length

  if (!comGeo.length) {
    return (
      <div className={className}>
        <div className="flex h-full flex-col items-center justify-center gap-2 bg-muted/20 px-4 text-center text-sm text-muted-foreground">
          <p>
            {pontos.length > 0
              ? `${semGeoCount} PDV(s) deste recorte sem coordenada no mapa.`
              : 'Nenhum PDV neste recorte.'}
          </p>
          {selectedSemGeo && selectedRow && (
            <p className="text-xs text-foreground">
              <span className="font-medium">{selectedRow.nome}</span> ainda não tem geocode CNEFE.
            </p>
          )}
        </div>
      </div>
    )
  }

  const hasSelection = selectedCnpj != null

  return (
    <div className={className}>
      <MapContainer
        center={FALLBACK_CENTER}
        zoom={14}
        className="h-full w-full"
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitPontos pontos={comGeo} />
        <FlyToSelected pontos={comGeo} selectedCnpj={selectedCnpj} />
        {outros.map((p) => (
          <DetalheMarker
            key={p.cnpj}
            p={p}
            selected={false}
            dimmed={hasSelection}
            onSelect={onSelect}
          />
        ))}
        {selecionado && (
          <DetalheMarker
            key={selecionado.cnpj}
            p={selecionado}
            selected
            dimmed={false}
            onSelect={onSelect}
          />
        )}
      </MapContainer>
      {(semGeoCount > 0 || selectedSemGeo) && (
        <p className="pointer-events-none absolute bottom-2 right-2 max-w-[min(100%,16rem)] rounded-md bg-background/95 px-2 py-1 text-[10px] text-muted-foreground shadow-sm ring-1 ring-border/50">
          {selectedSemGeo ? (
            <>
              <span className="font-medium text-foreground">{selectedRow?.nome}</span> sem ponto no
              mapa — geocode pendente
            </>
          ) : (
            `${semGeoCount} sem mapa · tracejado = localização aproximada`
          )}
        </p>
      )}
    </div>
  )
}
