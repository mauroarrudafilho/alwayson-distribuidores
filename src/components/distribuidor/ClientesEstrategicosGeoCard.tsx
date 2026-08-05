import { useCallback, useEffect, useRef, useState } from 'react'
import { MapPinned, Play, Square, RotateCcw } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  useGeoFilaEstrategicos,
  useRodarLoteGeoEstrategicos,
} from '@/hooks/useClientesEstrategicos'

/** Ritmo real medido pelo worker: ~1 chamada BrasilAPI + ~1 Nominatim por CNPJ. */
const SEGUNDOS_POR_CNPJ = 2.2

function estimativa(pendentes: number): string {
  const min = Math.round((pendentes * SEGUNDOS_POR_CNPJ) / 60)
  if (min < 1) return 'menos de 1 min'
  if (min < 60) return `~${min} min`
  const h = Math.floor(min / 60)
  const r = min % 60
  return r ? `~${h}h${String(r).padStart(2, '0')}` : `~${h}h`
}

/**
 * Progresso e comando da geocodificação da lista estratégica (admin).
 *
 * O trabalho não corre no browser: cada clique encadeia lotes curtos na Edge
 * Function `enrich-estrategicos-geo`, que consulta Receita/BrasilAPI e o
 * geocoder a partir da infra do Supabase. É o mesmo desenho do enriquecimento
 * da dimensão Insights — a diferença é só a tabela de destino.
 *
 * Fechar a aba **não perde trabalho**: o estado vive em `geo_status`, cada lote
 * é confirmado no banco, e outra sessão retoma de onde parou.
 */
export function ClientesEstrategicosGeoCard() {
  const { data: fila, refetch } = useGeoFilaEstrategicos()
  const rodarLote = useRodarLoteGeoEstrategicos()

  const [correndo, setCorrendo] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [acumulado, setAcumulado] = useState({ resolvidos: 0, sem_fonte: 0, falhas: 0 })
  const pararRef = useRef(false)

  // Se o componente sai de cena a meio, o loop tem de parar — senão continua a
  // disparar lotes contra um estado que ninguém está a ver.
  useEffect(() => () => { pararRef.current = true }, [])

  const rodarTudo = useCallback(async () => {
    pararRef.current = false
    setCorrendo(true)
    setAcumulado({ resolvidos: 0, sem_fonte: 0, falhas: 0 })
    setMsg(null)

    let semProgresso = 0
    try {
      for (;;) {
        if (pararRef.current) {
          setMsg('Parado. O que já foi gravado permanece — dá para retomar.')
          break
        }

        const r = await rodarLote.mutateAsync({})
        const avancou = (r.processed ?? 0) + (r.sem_fonte ?? 0) + (r.failed ?? 0)

        setAcumulado((a) => ({
          resolvidos: a.resolvidos + (r.processed ?? 0),
          sem_fonte: a.sem_fonte + (r.sem_fonte ?? 0),
          falhas: a.falhas + (r.failed ?? 0),
        }))

        const restam = r.fila?.pendentes ?? 0
        if (restam === 0) {
          setMsg('Fila concluída.')
          break
        }

        // Lote que não move nada significa fila travada (tudo em `processing`,
        // por exemplo). Insistir só queimaria chamadas externas.
        semProgresso = avancou === 0 ? semProgresso + 1 : 0
        if (semProgresso >= 2) {
          setMsg('A fila deixou de avançar — verifique os registos em processamento.')
          break
        }
      }
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e)
      setMsg(
        raw.includes('Failed to fetch') || raw.includes('EDGE_FUNCTION_INVOCATION_FAILED')
          ? 'Edge Function indisponível — publique `enrich-estrategicos-geo` antes de rodar.'
          : raw
      )
    } finally {
      setCorrendo(false)
      void refetch()
    }
  }, [rodarLote, refetch])

  const reenfileirar = useCallback(
    async (estado: 'error' | 'processing') => {
      try {
        const r = await rodarLote.mutateAsync({ requeue: estado })
        setMsg(`${r.requeued ?? 0} registo(s) voltaram para a fila.`)
        void refetch()
      } catch (e) {
        setMsg(e instanceof Error ? e.message : String(e))
      }
    },
    [rodarLote, refetch]
  )

  if (!fila) return null

  const total = fila.total || 1
  const pct = Math.round((fila.com_coordenada / total) * 100)

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="flex items-center gap-2 text-sm font-medium">
              <MapPinned className="h-4 w-4 text-muted-foreground" />
              Geolocalização da lista
            </p>
            <p className="text-xs text-muted-foreground">
              Coordenada resolvida pelo CNPJ contra fonte pública (Receita + geocoder), no
              servidor. Fechar a aba não perde o que já foi gravado.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {correndo ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  pararRef.current = true
                }}
              >
                <Square className="mr-1.5 h-3.5 w-3.5" />
                Parar
              </Button>
            ) : (
              <Button size="sm" onClick={() => void rodarTudo()} disabled={fila.pendentes === 0}>
                <Play className="mr-1.5 h-3.5 w-3.5" />
                Completar ({fila.pendentes.toLocaleString('pt-BR')})
              </Button>
            )}
            {fila.com_erro > 0 && !correndo && (
              <Button size="sm" variant="outline" onClick={() => void reenfileirar('error')}>
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                Repetir falhas ({fila.com_erro})
              </Button>
            )}
            {/* Lote interrompido a meio deixa linhas presas em `processing`. */}
            {fila.em_processamento > 0 && !correndo && (
              <Button size="sm" variant="outline" onClick={() => void reenfileirar('processing')}>
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                Destravar ({fila.em_processamento})
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <Progress value={pct} />
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              <span className="font-medium text-foreground">
                {fila.com_coordenada.toLocaleString('pt-BR')}
              </span>{' '}
              de {fila.total.toLocaleString('pt-BR')} com coordenada ({pct}%)
            </span>
            <span>
              {fila.pendentes > 0 && <>pendentes {fila.pendentes.toLocaleString('pt-BR')} · </>}
              {fila.sem_fonte > 0 && <>sem fonte {fila.sem_fonte.toLocaleString('pt-BR')} · </>}
              {fila.com_erro > 0 && <>erro {fila.com_erro.toLocaleString('pt-BR')} · </>}
              {fila.pendentes > 0 ? estimativa(fila.pendentes) : 'fila vazia'}
            </span>
          </div>
        </div>

        {correndo && (
          <p className="text-xs text-muted-foreground">
            A correr… resolvidos {acumulado.resolvidos} · sem coordenada na fonte{' '}
            {acumulado.sem_fonte}
            {acumulado.falhas > 0 && <> · falhas {acumulado.falhas}</>}
          </p>
        )}

        {msg && !correndo && <p className="text-xs text-muted-foreground">{msg}</p>}

        {fila.sem_fonte > 0 && !correndo && (
          <p className="text-[11px] text-muted-foreground/80">
            &ldquo;Sem fonte&rdquo; = a Receita devolveu o endereço mas o geocoder não encontrou o
            ponto. É limite da fonte pública, não erro da carga.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
