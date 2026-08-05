import { useMemo } from 'react'
import { CircleMarker, MapContainer, Popup, TileLayer, Tooltip } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { MapPin } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { formatCnpj } from '@/lib/format'
import {
  PRIORIDADE_CLASSE,
  PRIORIDADE_LABELS,
  type ClienteEstrategicoLinha,
} from '@/types/clientes-estrategicos'

/** Cor por classe ABC — mesma leitura da tabela. */
const COR_CLASSE: Record<string, string> = {
  alta: '#dc2626',
  media: '#f59e0b',
  baixa: '#64748b',
}

/** Raio por classe: o A tem de saltar à vista num mapa com centenas de pontos. */
const RAIO_CLASSE: Record<string, number> = { alta: 8, media: 6, baixa: 4 }

interface Props {
  linhas: ClienteEstrategicoLinha[]
}

/**
 * Mapa da lista estratégica.
 *
 * Só desenha quem tem coordenada. **A cobertura é dita em números no topo** de
 * propósito: com boa parte da lista sem geo, um mapa silencioso passaria a
 * impressão de que a praça está vazia, quando na verdade é o dado que falta.
 *
 * A coordenada vem por cascata de fonte pública (carteira → Receita/CNEFE →
 * histórico territorial → geocodificação própria). Ponto marcado como
 * `cidade_centroide` é aproximação da cidade, não do PDV.
 */
export function ClientesEstrategicosMapa({ linhas }: Props) {
  const comGeo = useMemo(
    () => linhas.filter((l) => l.lat_exibicao != null && l.lng_exibicao != null),
    [linhas]
  )

  const centro = useMemo<[number, number]>(() => {
    if (!comGeo.length) return [-9.0, -40.0] // Nordeste, enquadramento neutro
    const lat = comGeo.reduce((a, l) => a + (l.lat_exibicao ?? 0), 0) / comGeo.length
    const lng = comGeo.reduce((a, l) => a + (l.lng_exibicao ?? 0), 0) / comGeo.length
    return [lat, lng]
  }, [comGeo])

  const aproximados = comGeo.filter((l) => l.geo_fonte_exibicao === 'cidade_centroide').length

  if (comGeo.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <MapPin className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            Nenhum dos {linhas.length.toLocaleString('pt-BR')} CNPJs filtrados tem coordenada
            ainda.
          </p>
          <p className="mt-1 max-w-md text-xs text-muted-foreground/80">
            A coordenada é resolvida por fonte pública. Enquanto o pipeline de geocodificação não
            cobrir estas praças, o mapa fica vazio — não é ausência de PDV.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="space-y-2 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">
              {comGeo.length.toLocaleString('pt-BR')}
            </span>{' '}
            de {linhas.length.toLocaleString('pt-BR')} com coordenada
            {aproximados > 0 && (
              <span className="text-amber-600 dark:text-amber-400">
                {' '}
                · {aproximados} são centroide da cidade, não o PDV
              </span>
            )}
          </p>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            {(['alta', 'media', 'baixa'] as const).map((p) => (
              <span key={p} className="inline-flex items-center gap-1.5">
                <span
                  className="inline-block rounded-full"
                  style={{
                    background: COR_CLASSE[p],
                    width: RAIO_CLASSE[p] * 1.6,
                    height: RAIO_CLASSE[p] * 1.6,
                  }}
                  aria-hidden
                />
                {PRIORIDADE_CLASSE[p]}
              </span>
            ))}
          </div>
        </div>

        <div className="h-[520px] w-full overflow-hidden rounded-md border border-border/60">
          <MapContainer
            center={centro}
            zoom={6}
            scrollWheelZoom
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {comGeo.map((l) => (
              <CircleMarker
                key={l.id}
                center={[l.lat_exibicao!, l.lng_exibicao!]}
                radius={RAIO_CLASSE[l.prioridade] ?? 4}
                pathOptions={{
                  color: COR_CLASSE[l.prioridade] ?? '#64748b',
                  fillColor: COR_CLASSE[l.prioridade] ?? '#64748b',
                  fillOpacity: l.na_carteira ? 0.85 : 0.35,
                  weight: l.na_carteira ? 2 : 1,
                }}
              >
                <Tooltip>{l.nome_exibicao || formatCnpj(l.cnpj)}</Tooltip>
                <Popup>
                  <div className="space-y-0.5 text-xs">
                    <p className="font-medium">{l.nome_exibicao || 'Sem nome em fonte pública'}</p>
                    <p className="tabular-nums text-muted-foreground">{formatCnpj(l.cnpj)}</p>
                    <p className="text-muted-foreground">
                      {l.cidade_exibicao}/{l.estado_exibicao}
                    </p>
                    <p>
                      Classe {PRIORIDADE_CLASSE[l.prioridade]} ·{' '}
                      {PRIORIDADE_LABELS[l.prioridade]}
                    </p>
                    <p className="text-muted-foreground">
                      {l.na_carteira ? 'Já na carteira' : 'Fora da carteira'}
                    </p>
                    {l.geo_fonte_exibicao === 'cidade_centroide' && (
                      <p className="text-amber-600">Posição aproximada pela cidade</p>
                    )}
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>

        <p className="text-[11px] text-muted-foreground">
          Preenchido = já na carteira · contorno vago = alvo territorial ainda não atendido.
        </p>
      </CardContent>
    </Card>
  )
}
