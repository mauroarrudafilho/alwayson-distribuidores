import { useMemo, useState } from 'react'
import { Users, ArrowRightLeft, AlertCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  useCarteiraContagem,
  useClientesDoVendedor,
  useReatribuirCliente,
} from '@/hooks/useCarteiraVendedor'
import { useAuth } from '@/contexts/auth'
import type { Vendedor } from '@/types/distribuidor'

interface Props {
  distribuidorId: string
  /** Todos os vendedores do distribuidor (a hierarquia já os carrega). */
  vendedores: Vendedor[]
}

export function CarteiraVendedorCard({ distribuidorId, vendedores }: Props) {
  const { isAdmin } = useAuth()
  const [vendedorId, setVendedorId] = useState<string>('')
  const [movendo, setMovendo] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const { data: contagem } = useCarteiraContagem(distribuidorId)
  const { data: clientes, isLoading } = useClientesDoVendedor(vendedorId || undefined)
  const reatribuir = useReatribuirCliente()

  // Só vendedores de campo carregam carteira; supervisores e gerentes não.
  const opcoes = useMemo(
    () => vendedores.filter((v) => v.tipo === 'vendedor'),
    [vendedores],
  )

  const semVendedor = contagem?.get('__sem_vendedor__') ?? 0

  async function mover(clienteId: string, novoVendedorId: string) {
    setErro(null)
    setMovendo(clienteId)
    try {
      await reatribuir.mutateAsync({ clienteId, novoVendedorId })
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao remanejar o cliente.')
    } finally {
      setMovendo(null)
    }
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
            <Users className="w-4 h-4" />
            Carteira por vendedor
          </h3>
          {semVendedor > 0 && (
            <Badge variant="secondary" className="text-[10px]">
              {semVendedor} sem vendedor
            </Badge>
          )}
        </div>

        <p className="text-[11px] text-muted-foreground">
          Correção pontual — para remanejar um cliente que ficou com o vendedor errado. A carga
          da base continua pelo template <code>clientes</code> da ingestão.
        </p>

        <div className="max-w-sm">
          <Select value={vendedorId} onValueChange={(v) => setVendedorId(v ?? '')}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Selecione o vendedor…" />
            </SelectTrigger>
            <SelectContent>
              {opcoes.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.nome} · {contagem?.get(v.id) ?? 0}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {erro && (
          <p className="text-xs text-destructive flex items-start gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            {erro}
          </p>
        )}

        {vendedorId && (
          <div className="border-t pt-3">
            {isLoading ? (
              <p className="text-xs text-muted-foreground py-2">Carregando…</p>
            ) : (clientes ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">
                Este vendedor não tem clientes na carteira.
              </p>
            ) : (
              <ul className="divide-y max-h-80 overflow-y-auto">
                {(clientes ?? []).map((c) => (
                  <li
                    key={c.id}
                    className="py-2 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">
                        {c.nome_fantasia || c.razao_social}
                      </p>
                      <p className="text-muted-foreground">
                        <span className="font-mono">{c.cnpj}</span>
                        {c.cidade && c.cidade !== '—' && ` · ${c.cidade}/${c.estado}`}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <ArrowRightLeft className="w-3 h-3 text-muted-foreground" />
                      <Select
                        value=""
                        onValueChange={(v) => v && mover(c.id, v)}
                        disabled={!isAdmin || movendo === c.id}
                      >
                        <SelectTrigger className="h-7 w-40 text-[11px]">
                          <SelectValue
                            placeholder={movendo === c.id ? 'Movendo…' : 'Mover para…'}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {opcoes
                            .filter((v) => v.id !== vendedorId)
                            .map((v) => (
                              <SelectItem key={v.id} value={v.id}>
                                {v.nome}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {!isAdmin && (
          <p className="text-[11px] text-muted-foreground">
            Apenas administradores podem remanejar clientes.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
