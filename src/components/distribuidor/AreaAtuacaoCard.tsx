import { useState } from 'react'
import { MapPin, Plus, X, Users, Landmark, TrendingUp, Search } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  useAreaAtuacao,
  useCidadesDoDistribuidor,
  useBuscaMunicipios,
  useAdicionarCidade,
  useRemoverCidade,
  useAtualizarDimensionamento,
} from '@/hooks/useDistribuidorAreaAtuacao'
import { useAuth } from '@/contexts/auth'
import { formatCurrency } from '@/lib/format'
import type { Distribuidor } from '@/types/distribuidor'

const FREQUENCIAS: { value: NonNullable<Distribuidor['frequencia_visita']>; label: string }[] = [
  { value: 'semanal', label: 'Semanal' },
  { value: 'quinzenal', label: 'Quinzenal' },
  { value: 'mensal', label: 'Mensal' },
  { value: 'outro', label: 'Outro' },
]

function Indicador({
  icon: Icon,
  label,
  valor,
  detalhe,
}: {
  icon: typeof Users
  label: string
  valor: string
  detalhe?: string
}) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
        <Icon className="w-3 h-3" />
        {label}
      </div>
      <div className="text-sm font-medium tabular-nums">{valor}</div>
      {detalhe && <div className="text-[11px] text-muted-foreground">{detalhe}</div>}
    </div>
  )
}

export function AreaAtuacaoCard({ distribuidor }: { distribuidor: Distribuidor }) {
  const { isAdmin } = useAuth()
  const [editando, setEditando] = useState(false)
  const [busca, setBusca] = useState('')

  const { data: area } = useAreaAtuacao(distribuidor.id)
  const { data: cidades } = useCidadesDoDistribuidor(distribuidor.id)
  const { data: sugestoes, isLoading: buscando } = useBuscaMunicipios(busca)
  const adicionar = useAdicionarCidade()
  const remover = useRemoverCidade()
  const salvar = useAtualizarDimensionamento()

  const [carteira, setCarteira] = useState(String(distribuidor.carteira_declarada ?? ''))
  const [frequencia, setFrequencia] = useState(distribuidor.frequencia_visita ?? '')
  const [inicio, setInicio] = useState(distribuidor.inicio_parceria ?? '')

  const declarada = area?.carteira_declarada ?? null
  const cadastrada = area?.carteira_cadastrada ?? 0
  const lacuna = declarada !== null ? declarada - cadastrada : null

  async function handleSalvar() {
    const n = Number(carteira)
    await salvar.mutateAsync({
      distribuidorId: distribuidor.id,
      carteira_declarada: carteira.trim() === '' || !Number.isFinite(n) ? null : n,
      frequencia_visita: (frequencia || null) as Distribuidor['frequencia_visita'],
      inicio_parceria: inicio || null,
    })
    setEditando(false)
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-foreground">Dimensionamento e área de atuação</h3>
          {!editando && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              disabled={!isAdmin}
              title={!isAdmin ? 'Apenas administradores editam o cadastro.' : undefined}
              onClick={() => setEditando(true)}
            >
              Editar
            </Button>
          )}
        </div>

        {/* Indicadores derivados */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Indicador
            icon={MapPin}
            label="Cidades"
            valor={String(area?.cidades_atuacao ?? 0)}
            detalhe="sob responsabilidade"
          />
          <Indicador
            icon={Landmark}
            label="População coberta"
            valor={(area?.populacao_coberta ?? 0).toLocaleString('pt-BR')}
            detalhe="IBGE, censo 2022"
          />
          <Indicador
            icon={TrendingUp}
            label="Potencial demonstrado"
            valor={formatCurrency(Number(area?.potencial_demonstrado ?? 0))}
            detalhe={`${Number(area?.pdvs_no_historico ?? 0).toLocaleString('pt-BR')} PDVs · histórico 2022–24`}
          />
          <Indicador
            icon={Users}
            label="Carteira"
            valor={
              declarada !== null
                ? `${cadastrada.toLocaleString('pt-BR')} / ${declarada.toLocaleString('pt-BR')}`
                : cadastrada.toLocaleString('pt-BR')
            }
            detalhe={
              lacuna === null
                ? 'cadastrada (sem declaração)'
                : lacuna > 0
                  ? `${lacuna.toLocaleString('pt-BR')} PDVs declarados sem carga`
                  : lacuna < 0
                    ? `${Math.abs(lacuna).toLocaleString('pt-BR')} acima do declarado`
                    : 'carga completa'
            }
          />
        </div>

        <p className="text-[11px] text-muted-foreground border-l-2 border-muted pl-2">
          Potencial demonstrado é o faturamento histórico dessas cidades na operação anterior
          (jan/2022–dez/2024). Serve de referência do que a praça já entregou — não é meta corrente.
        </p>

        {/* Campos editáveis */}
        {editando ? (
          <div className="space-y-3 border-t pt-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Carteira declarada (PDVs)</label>
                <Input
                  inputMode="numeric"
                  value={carteira}
                  onChange={(e) => setCarteira(e.target.value)}
                  placeholder="Ex.: 850"
                  className="h-9 text-sm tabular-nums"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Frequência de visita</label>
                <Select value={frequencia} onValueChange={(v) => setFrequencia((v ?? '') as typeof frequencia)}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Selecione…" />
                  </SelectTrigger>
                  <SelectContent>
                    {FREQUENCIAS.map((f) => (
                      <SelectItem key={f.value} value={f.value}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Início da parceria</label>
                <Input
                  type="date"
                  value={inicio}
                  onChange={(e) => setInicio(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEditando(false)}
                disabled={salvar.isPending}
              >
                Cancelar
              </Button>
              <Button size="sm" onClick={handleSalvar} disabled={salvar.isPending}>
                {salvar.isPending ? 'Gravando…' : 'Gravar'}
              </Button>
            </div>
          </div>
        ) : (
          <dl className="grid gap-3 sm:grid-cols-3 border-t pt-3 text-xs">
            <div>
              <dt className="text-muted-foreground">Carteira declarada</dt>
              <dd className="tabular-nums">
                {distribuidor.carteira_declarada?.toLocaleString('pt-BR') ?? '—'}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Frequência de visita</dt>
              <dd className="capitalize">{distribuidor.frequencia_visita ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Início da parceria</dt>
              <dd>
                {distribuidor.inicio_parceria
                  ? new Date(`${distribuidor.inicio_parceria}T00:00:00`).toLocaleDateString('pt-BR')
                  : '—'}
              </dd>
            </div>
          </dl>
        )}

        {/* Cidades */}
        <div className="border-t pt-3 space-y-2">
          <div className="text-xs font-medium">Cidades responsáveis</div>

          <div className="flex flex-wrap gap-1.5">
            {(cidades ?? []).length === 0 && (
              <p className="text-xs text-muted-foreground">
                Nenhuma cidade atribuída — sem isso não há população nem potencial para comparar.
              </p>
            )}
            {(cidades ?? []).map((c) => (
              <Badge key={c.codigo_ibge} variant="secondary" className="gap-1 text-[11px] font-normal">
                {c.cidade_exibicao}/{c.estado}
                {isAdmin && (
                  <button
                    type="button"
                    aria-label={`Remover ${c.cidade_exibicao}`}
                    className="hover:text-destructive"
                    onClick={() =>
                      remover.mutate({ distribuidorId: distribuidor.id, codigoIbge: c.codigo_ibge })
                    }
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </Badge>
            ))}
          </div>

          {isAdmin && (
            <div className="space-y-1.5">
              <div className="relative max-w-sm">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar município para adicionar…"
                  className="h-8 text-sm pl-8"
                />
              </div>

              {busca.trim().length >= 2 && (
                <div className="border rounded-md max-h-48 overflow-y-auto bg-popover max-w-sm">
                  {buscando ? (
                    <p className="text-xs text-muted-foreground px-3 py-2">Buscando…</p>
                  ) : (sugestoes ?? []).length === 0 ? (
                    <p className="text-xs text-muted-foreground px-3 py-2">
                      Nenhum município encontrado.
                    </p>
                  ) : (
                    <ul className="divide-y">
                      {(sugestoes ?? []).map((m) => (
                        <li key={m.codigo_ibge}>
                          <button
                            type="button"
                            className="w-full px-3 py-1.5 text-left text-xs hover:bg-accent flex items-center justify-between gap-2"
                            onClick={() => {
                              adicionar.mutate({
                                distribuidorId: distribuidor.id,
                                codigoIbge: m.codigo_ibge,
                              })
                              setBusca('')
                            }}
                          >
                            <span>
                              {m.cidade_exibicao}/{m.estado}
                            </span>
                            <span className="text-muted-foreground tabular-nums">
                              {m.populacao?.toLocaleString('pt-BR') ?? '—'} hab.
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Plus className="w-3 h-3" />
                Municípios do IBGE — a população e o potencial vêm junto com a seleção.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
