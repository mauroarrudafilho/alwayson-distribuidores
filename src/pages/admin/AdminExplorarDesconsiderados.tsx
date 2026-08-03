import { useMemo, useState } from 'react'
import { EyeOff, RotateCcw } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { InsightsSearchField } from '@/components/insights/InsightsSearchField'
import { SectionTitle } from '@/components/distribuidor/SectionTitle'
import {
  usePdvDesconsideradosDetalhe,
  useRestaurarPdv,
} from '@/hooks/usePdvDesconsiderados'
import { formatCnpj, formatDateTime } from '@/lib/format'

const MOTIVO_LABEL: Record<string, string> = {
  fora_do_mix: 'Fora do mix',
}

function labelMotivo(motivo: string | null): string {
  if (!motivo?.trim()) return '—'
  return MOTIVO_LABEL[motivo] ?? motivo
}

function matchesBusca(
  q: string,
  row: { cnpj: string; nome: string; bairro: string | null; segmento_cnae: string }
): boolean {
  const n = q.trim().toLowerCase()
  if (!n) return true
  const hay = [row.cnpj, row.nome, row.bairro ?? '', row.segmento_cnae].join(' ').toLowerCase()
  return hay.includes(n)
}

export function AdminExplorarDesconsiderados() {
  const [busca, setBusca] = useState('')
  const [restaurandoCnpj, setRestaurandoCnpj] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const { data: rows, isLoading, isError } = usePdvDesconsideradosDetalhe()
  const restaurar = useRestaurarPdv()

  const filtrados = useMemo(() => {
    const list = rows ?? []
    if (!busca.trim()) return list
    return list.filter((r) => matchesBusca(busca, r))
  }, [rows, busca])

  const handleRestaurar = async (cnpj: string, nome: string) => {
    setNotice(null)
    setRestaurandoCnpj(cnpj)
    try {
      await restaurar.mutateAsync(cnpj)
      setNotice(`${nome} voltou ao Explorar.`)
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Falha ao restaurar PDV.')
    } finally {
      setRestaurandoCnpj(null)
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <SectionTitle title="PDVs desconsiderados" icon={EyeOff} />
            <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
              CNPJs marcados com &quot;não se aplica&quot; no Explorar (Cobertura ou Prioridade).
              Restaurar devolve o PDV às listas e ao mapa; os totais da aba Cobertura são ajustados
              automaticamente no banco.
            </p>
          </div>
          <Badge variant="secondary" className="tabular-nums">
            {(rows?.length ?? 0).toLocaleString('pt-BR')} PDVs
          </Badge>
        </div>

        <InsightsSearchField
          value={busca}
          onChange={setBusca}
          placeholder="Buscar CNPJ, nome, bairro ou segmento…"
        />

        {notice && <p className="text-xs text-muted-foreground">{notice}</p>}
        {isError && (
          <p className="text-xs text-destructive">Não foi possível carregar a lista.</p>
        )}

        {isLoading ? (
          <Skeleton className="mt-2 h-40 w-full" />
        ) : filtrados.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">
            {(rows?.length ?? 0) === 0
              ? 'Nenhum PDV desconsiderado — todos do universo aparecem no Explorar.'
              : 'Nenhum resultado para a busca.'}
          </p>
        ) : (
          <div className="max-h-[min(32rem,60vh)] overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs">PDV</TableHead>
                  <TableHead className="hidden text-xs md:table-cell">Bairro</TableHead>
                  <TableHead className="hidden text-xs lg:table-cell">Segmento CNAE</TableHead>
                  <TableHead className="text-xs">Motivo</TableHead>
                  <TableHead className="text-xs">Desde</TableHead>
                  <TableHead className="w-[100px] text-xs" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.map((r) => {
                  const busy = restaurandoCnpj === r.cnpj || restaurar.isPending
                  return (
                    <TableRow key={r.cnpj}>
                      <TableCell className="align-top py-2">
                        <p className="text-sm font-medium">{r.nome}</p>
                        <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                          {formatCnpj(r.cnpj)}
                        </p>
                        {r.municipio && (
                          <p className="mt-0.5 text-[10px] text-muted-foreground">
                            {r.municipio}
                            {r.uf ? `/${r.uf}` : ''}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="hidden align-top py-2 text-xs text-muted-foreground md:table-cell">
                        {r.bairro ?? '—'}
                      </TableCell>
                      <TableCell className="hidden align-top py-2 text-xs text-muted-foreground lg:table-cell">
                        {r.segmento_cnae}
                      </TableCell>
                      <TableCell className="align-top py-2 text-xs">{labelMotivo(r.motivo)}</TableCell>
                      <TableCell className="align-top py-2 text-xs tabular-nums text-muted-foreground">
                        {formatDateTime(r.criado_em)}
                      </TableCell>
                      <TableCell className="align-top py-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5 text-xs"
                          disabled={busy}
                          onClick={() => void handleRestaurar(r.cnpj, r.nome)}
                        >
                          <RotateCcw className="size-3.5" />
                          Restaurar
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
