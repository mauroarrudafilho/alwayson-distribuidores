import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, Loader2, Plus, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/distribuidor/PageHeader'
import { FilterField } from '@/components/distribuidor/FilterBar'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { supabase } from '@/lib/supabase'
import { parseInsightsCnpj } from '@/lib/insightsCnpj'
import { formatCnpj } from '@/lib/format'

type RedeRow = {
  id: string
  nome: string
  criado_em: string
  atualizado_em: string
}

type MembroRow = {
  cnpj_cliente: string
  nome_cliente: string | null
  razao_social: string | null
}

export function AdminInsightsRedes() {
  const qc = useQueryClient()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [novaRedeOpen, setNovaRedeOpen] = useState(false)
  const [novaRedeNome, setNovaRedeNome] = useState('')
  const [cnpjInput, setCnpjInput] = useState('')
  const [cnpjError, setCnpjError] = useState<string | null>(null)
  const [nomeEdit, setNomeEdit] = useState('')

  const redesQ = useQuery({
    queryKey: ['admin', 'insights-redes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('alwayson_insights_redes')
        .select('id, nome, criado_em, atualizado_em')
        .order('nome')
      if (error) throw error
      return (data ?? []) as RedeRow[]
    },
  })

  const membrosQ = useQuery({
    queryKey: ['admin', 'insights-rede-membros', selectedId],
    enabled: !!selectedId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('alwayson_insights_v_clientes_com_rede')
        .select('cnpj_cliente, nome_cliente, razao_social')
        .eq('rede_id', selectedId!)
        .order('cnpj_cliente')
      if (error) throw error
      return (data ?? []) as MembroRow[]
    },
  })

  const countsByRede = useQuery({
    queryKey: ['admin', 'insights-rede-membros-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('alwayson_insights_rede_membros')
        .select('rede_id')
      if (error) throw error
      const m = new Map<string, number>()
      for (const r of data ?? []) {
        const id = String((r as { rede_id: string }).rede_id)
        m.set(id, (m.get(id) ?? 0) + 1)
      }
      return m
    },
  })

  const selectedRede = useMemo(
    () => redesQ.data?.find((r) => r.id === selectedId) ?? null,
    [redesQ.data, selectedId]
  )

  useEffect(() => {
    if (selectedRede) setNomeEdit(selectedRede.nome)
  }, [selectedRede])

  const invalidateInsights = () => {
    void qc.invalidateQueries({ queryKey: ['insights'] })
    void qc.invalidateQueries({ queryKey: ['admin', 'insights-redes'] })
    void qc.invalidateQueries({ queryKey: ['admin', 'insights-rede-membros'] })
    void qc.invalidateQueries({ queryKey: ['admin', 'insights-rede-membros-counts'] })
  }

  const createRede = useMutation({
    mutationFn: async (nome: string) => {
      const { data, error } = await supabase
        .from('alwayson_insights_redes')
        .insert({ nome: nome.trim() })
        .select('id')
        .single()
      if (error) throw error
      return data as { id: string }
    },
    onSuccess: (row) => {
      invalidateInsights()
      setNovaRedeOpen(false)
      setNovaRedeNome('')
      setSelectedId(row.id)
    },
  })

  const updateNome = useMutation({
    mutationFn: async ({ id, nome }: { id: string; nome: string }) => {
      const { error } = await supabase
        .from('alwayson_insights_redes')
        .update({ nome: nome.trim() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => invalidateInsights(),
  })

  const deleteRede = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('alwayson_insights_redes').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      setSelectedId(null)
      invalidateInsights()
    },
  })

  const addMembro = useMutation({
    mutationFn: async ({ redeId, cnpj14 }: { redeId: string; cnpj14: string }) => {
      const { error } = await supabase
        .from('alwayson_insights_rede_membros')
        .insert({ rede_id: redeId, cnpj_14: cnpj14 })
      if (error) throw error
    },
    onSuccess: () => {
      setCnpjInput('')
      setCnpjError(null)
      invalidateInsights()
    },
    onError: (e: unknown) => {
      const msg = e && typeof e === 'object' && 'message' in e ? String((e as Error).message) : ''
      if (/23503|foreign key/i.test(msg)) {
        setCnpjError('CNPJ não existe na dimensão Insights.')
      } else if (/23505|unique/i.test(msg)) {
        setCnpjError('CNPJ já está em outra rede.')
      } else {
        setCnpjError(msg || 'Erro ao vincular.')
      }
    },
  })

  const removeMembro = useMutation({
    mutationFn: async ({ redeId, cnpj14 }: { redeId: string; cnpj14: string }) => {
      const { error } = await supabase
        .from('alwayson_insights_rede_membros')
        .delete()
        .eq('rede_id', redeId)
        .eq('cnpj_14', cnpj14)
      if (error) throw error
    },
    onSuccess: () => invalidateInsights(),
  })

  const handleAddCnpj = () => {
    setCnpjError(null)
    if (!selectedId) return
    const p = parseInsightsCnpj(cnpjInput)
    if (!p.ok) {
      setCnpjError('CNPJ inválido.')
      return
    }
    addMembro.mutate({ redeId: selectedId, cnpj14: p.cnpj14 })
  }

  const countMap = countsByRede.data ?? new Map<string, number>()

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Redes manuais (Insights)"
          description="CNPJs vinculados agregam nesta rede no sell-out; demais seguem a raiz automática. Um CNPJ só pode pertencer a uma rede."
        />
        <Button size="sm" className="shrink-0 gap-1" onClick={() => setNovaRedeOpen(true)}>
          <Plus className="w-4 h-4" />
          Nova rede
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-4">
          <CardContent className="p-0">
            {redesQ.isLoading ? (
              <div className="p-4 space-y-2">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
              </div>
            ) : (
              <Table>
                <TableBody>
                  {(redesQ.data ?? []).length === 0 && (
                    <TableRow>
                      <TableCell className="text-sm text-muted-foreground py-8 text-center">
                        Nenhuma rede. Crie uma para começar.
                      </TableCell>
                    </TableRow>
                  )}
                  {(redesQ.data ?? []).map((r) => (
                    <TableRow
                      key={r.id}
                      className={`cursor-pointer ${selectedId === r.id ? 'bg-muted/50' : ''}`}
                      onClick={() => setSelectedId(r.id)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span className="font-medium truncate">{r.nome}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground tabular-nums mt-0.5">
                          {countMap.get(r.id) ?? 0} lojas
                        </p>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {redesQ.isError && (
              <p className="text-sm text-destructive p-4">
                {redesQ.error instanceof Error ? redesQ.error.message : 'Erro ao listar redes.'}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-8">
          <CardContent className="p-4 space-y-4">
            {!selectedRede ? (
              <p className="text-sm text-muted-foreground py-12 text-center">
                Selecione uma rede ou crie uma nova.
              </p>
            ) : (
              <>
                <div className="mb-4">
                  <FilterField label="Nome da rede">
                    <div className="flex flex-wrap gap-2 items-center">
                      <Input
                        value={nomeEdit}
                        onChange={(e) => setNomeEdit(e.target.value)}
                        className="h-9 max-w-md"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={
                          updateNome.isPending ||
                          !nomeEdit.trim() ||
                          nomeEdit.trim() === selectedRede.nome
                        }
                        onClick={() =>
                          updateNome.mutate({ id: selectedRede.id, nome: nomeEdit })
                        }
                      >
                        Salvar nome
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        className="ml-auto"
                        disabled={deleteRede.isPending}
                        onClick={() => {
                          if (
                            window.confirm(
                              `Excluir rede "${selectedRede.nome}" e desvincular todos os CNPJs?`
                            )
                          ) {
                            deleteRede.mutate(selectedRede.id)
                          }
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1" />
                        Excluir rede
                      </Button>
                    </div>
                  </FilterField>
                </div>

                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Adicionar CNPJ
                  </p>
                  <div className="flex flex-wrap gap-2 items-start">
                    <Input
                      placeholder="14 dígitos ou formatado"
                      value={cnpjInput}
                      onChange={(e) => {
                        setCnpjInput(e.target.value)
                        setCnpjError(null)
                      }}
                      className="h-9 max-w-xs font-mono text-sm"
                    />
                    <Button
                      type="button"
                      size="sm"
                      disabled={addMembro.isPending}
                      onClick={handleAddCnpj}
                    >
                      {addMembro.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        'Vincular'
                      )}
                    </Button>
                  </div>
                  {cnpjError && <p className="text-xs text-destructive mt-1">{cnpjError}</p>}
                </div>

                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Lojas nesta rede
                  </p>
                  {membrosQ.isLoading ? (
                    <Skeleton className="h-24 w-full" />
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="font-mono text-xs">CNPJ</TableHead>
                          <TableHead>Nome</TableHead>
                          <TableHead className="w-24 text-right" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(membrosQ.data ?? []).length === 0 && (
                          <TableRow>
                            <TableCell colSpan={3} className="text-sm text-muted-foreground py-6">
                              Nenhum CNPJ vinculado.
                            </TableCell>
                          </TableRow>
                        )}
                        {(membrosQ.data ?? []).map((m) => {
                          const label =
                            (m.nome_cliente?.trim() ||
                              m.razao_social?.trim() ||
                              '—') as string
                          return (
                            <TableRow key={m.cnpj_cliente}>
                              <TableCell className="font-mono text-xs tabular-nums">
                                {formatCnpj(m.cnpj_cliente)}
                              </TableCell>
                              <TableCell className="max-w-[240px] truncate">{label}</TableCell>
                              <TableCell className="text-right">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 text-xs text-destructive"
                                  disabled={removeMembro.isPending}
                                  onClick={() =>
                                    removeMembro.mutate({
                                      redeId: selectedRede.id,
                                      cnpj14: m.cnpj_cliente,
                                    })
                                  }
                                >
                                  Remover
                                </Button>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={novaRedeOpen} onOpenChange={setNovaRedeOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova rede</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Nome"
            value={novaRedeNome}
            onChange={(e) => setNovaRedeNome(e.target.value)}
            className="h-9"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovaRedeOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={!novaRedeNome.trim() || createRede.isPending}
              onClick={() => createRede.mutate(novaRedeNome)}
            >
              {createRede.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
