import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import {
  EXPLORAR_VERSAO_MODELO,
  geoConfiavelMapa,
  nomePdv,
  pdvPlotavelMapa,
} from '@/lib/pdv'
import { carregarPdvDesconsideradosSet } from '@/hooks/usePdvDesconsiderados'
import { labelCnaeGrupo, labelSegmentoCnae, bairroCoberturaLabel } from '@/lib/pdvCnaeSegmento'
import type {
  PdvCoberturaDetalheRow,
  PdvCoberturaRow,
  PdvMapaPonto,
  PdvPrioridadeRow,
  PdvResumo,
  PdvSegmento,
} from '@/types/pdv'

function normalizaCnpj(raw: string) {
  return String(raw).replace(/\D/g, '').padStart(14, '0').slice(0, 14)
}

const FAIXA_ORDEM: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 }

function compararPrioridade(a: PdvPrioridadeRow, b: PdvPrioridadeRow): number {
  if (a.atendido !== b.atendido) return a.atendido ? 1 : -1
  const fa = FAIXA_ORDEM[a.faixa ?? ''] ?? 9
  const fb = FAIXA_ORDEM[b.faixa ?? ''] ?? 9
  if (fa !== fb) return fa - fb
  return (Number(b.potencial_estimado_mensal) || 0) - (Number(a.potencial_estimado_mensal) || 0)
}

export function useExplorarPrioridade(
  distribuidorId: string | undefined,
  fornecedorTenantId: string | undefined,
  codigoIbge?: number | null
) {
  return useQuery({
    queryKey: [
      'explorar-prioridade',
      distribuidorId,
      fornecedorTenantId,
      EXPLORAR_VERSAO_MODELO,
      codigoIbge ?? 'all',
    ],
    enabled: !!distribuidorId && !!fornecedorTenantId,
    queryFn: async (): Promise<PdvPrioridadeRow[]> => {
      const desconsiderados = await carregarPdvDesconsideradosSet()

      const { data: clientes, error: errC } = await supabase
        .from('alwayson_clientes_distribuidor')
        .select('id, cnpj, vendedor_id, nome_fantasia, razao_social')
        .eq('distribuidor_id', distribuidorId!)
      if (errC) throw errC

      const clientesPorCnpj = new Map(
        (clientes ?? []).map((c) => [normalizaCnpj(c.cnpj), c] as const)
      )

      const { data: prioridadeDb, error: errP } = await supabase
        .from('alwayson_pdv_prioridade')
        .select('*')
        .eq('distribuidor_id', distribuidorId!)
        .eq('fornecedor_tenant_id', fornecedorTenantId!)
        .eq('versao_modelo', EXPLORAR_VERSAO_MODELO)
      if (errP) throw errP

      const prioridadeMap = new Map((prioridadeDb ?? []).map((r) => [r.cnpj, r]))

      const universo: Array<{
        cnpj: string
        nome_fantasia: string | null
        razao_social: string | null
        bairro: string | null
        cnae_principal: string | null
      }> = []

      for (let from = 0; ; from += 1000) {
        let q = supabase
          .from('alwayson_pdv_universo')
          .select('cnpj, nome_fantasia, razao_social, bairro, cnae_principal')
        if (codigoIbge != null) q = q.eq('codigo_ibge', codigoIbge)
        const { data, error } = await q.range(from, from + 999)
        if (error) throw error
        if (!data?.length) break
        universo.push(...(data as typeof universo))
        if (data.length < 1000) break
      }

      const scoreMap = new Map<
        string,
        { indice: number; faixa: string | null }
      >()
      const cnps = universo.map((u) => u.cnpj)
      for (let i = 0; i < cnps.length; i += 500) {
        const { data, error } = await supabase
          .from('alwayson_pdv_score')
          .select('cnpj, potencial_estimado_mensal, faixa')
          .eq('versao_modelo', EXPLORAR_VERSAO_MODELO)
          .in('cnpj', cnps.slice(i, i + 500))
        if (error) throw error
        for (const s of data ?? []) {
          scoreMap.set(s.cnpj, {
            indice: Number(s.potencial_estimado_mensal) || 0,
            faixa: s.faixa ?? null,
          })
        }
      }

      const vendedorIds = [
        ...new Set(
          (prioridadeDb ?? [])
            .map((r) => r.vendedor_id)
            .filter(Boolean)
        ),
      ] as string[]
      const vendedorMap = new Map<string, string>()
      if (vendedorIds.length) {
        const { data, error: e4 } = await supabase
          .from('alwayson_vendedores_distribuidor')
          .select('id, nome')
          .in('id', vendedorIds)
        if (e4) throw e4
        for (const v of data ?? []) vendedorMap.set(v.id, v.nome)
      }

      const rows: PdvPrioridadeRow[] = []

      for (const u of universo) {
        if (desconsiderados.has(u.cnpj)) continue
        const score = scoreMap.get(u.cnpj)
        if (!score) continue

        const cliente = clientesPorCnpj.get(u.cnpj)
        const pri = prioridadeMap.get(u.cnpj)
        const segmentoCnae = labelSegmentoCnae(u.cnae_principal)

        if (cliente) {
          const segmento =
            pri && pri.segmento !== 'nao_atendido'
              ? (pri.segmento as PdvSegmento)
              : ('maduro' as PdvSegmento)

          rows.push({
            id: pri?.id ?? `cart-${u.cnpj}`,
            cnpj: u.cnpj,
            segmento,
            potencial_estimado_mensal: score.indice,
            compra_media_mensal: pri?.compra_media_mensal ?? null,
            gap_reais: pri?.gap_reais ?? null,
            percentual_do_potencial: pri?.percentual_do_potencial ?? null,
            vendedor_id: pri?.vendedor_id ?? cliente.vendedor_id ?? null,
            cliente_id: cliente.id,
            nome_exibicao: nomePdv(cliente.nome_fantasia ?? u.nome_fantasia, cliente.razao_social ?? u.razao_social),
            bairro: u.bairro ?? null,
            cnae_principal: u.cnae_principal ?? null,
            vendedor_nome: pri?.vendedor_id
              ? vendedorMap.get(pri.vendedor_id) ?? null
              : null,
            atendido: true,
            faixa: score.faixa,
            segmento_cnae: segmentoCnae,
          })
          continue
        }

        rows.push({
          id: pri?.id ?? `opp-${u.cnpj}`,
          cnpj: u.cnpj,
          segmento: 'nao_atendido',
          potencial_estimado_mensal: score.indice,
          compra_media_mensal: null,
          gap_reais: null,
          percentual_do_potencial: null,
          vendedor_id: null,
          cliente_id: null,
          nome_exibicao: nomePdv(u.nome_fantasia, u.razao_social),
          bairro: u.bairro ?? null,
          cnae_principal: u.cnae_principal ?? null,
          vendedor_nome: null,
          atendido: false,
          faixa: score.faixa,
          segmento_cnae: segmentoCnae,
        })
      }

      return rows.sort(compararPrioridade)
    },
  })
}

export function useExplorarCobertura(
  distribuidorId: string | undefined,
  fornecedorTenantId: string | undefined,
  codigoIbge?: number | null
) {
  return useQuery({
    queryKey: ['explorar-cobertura', distribuidorId, fornecedorTenantId, codigoIbge ?? 'all'],
    enabled: !!distribuidorId && !!fornecedorTenantId,
    queryFn: async (): Promise<PdvCoberturaRow[]> => {
      let q = supabase
        .from('alwayson_pdv_cobertura')
        .select('*')
        .eq('distribuidor_id', distribuidorId!)
        .eq('fornecedor_tenant_id', fornecedorTenantId!)
      if (codigoIbge != null) q = q.eq('codigo_ibge', codigoIbge)
      const { data, error } = await q.order('potencial_nao_atendido', {
        ascending: false,
        nullsFirst: false,
      })

      if (error) throw error
      return (data ?? []) as PdvCoberturaRow[]
    },
  })
}

export function useExplorarCoberturaDetalhe(
  distribuidorId: string | undefined,
  fornecedorTenantId: string | undefined,
  codigoIbge: number | null | undefined,
  grupo: Pick<PdvCoberturaRow, 'bairro' | 'cnae_grupo' | 'municipio' | 'uf'> | null
) {
  return useQuery({
    queryKey: [
      'explorar-cobertura-detalhe',
      distribuidorId,
      fornecedorTenantId,
      EXPLORAR_VERSAO_MODELO,
      codigoIbge ?? 'all',
      grupo?.bairro,
      grupo?.cnae_grupo,
    ],
    enabled: !!distribuidorId && !!fornecedorTenantId && !!grupo,
    queryFn: async (): Promise<PdvCoberturaDetalheRow[]> => {
      const desconsiderados = await carregarPdvDesconsideradosSet()

      const { data: clientes, error: errC } = await supabase
        .from('alwayson_clientes_distribuidor')
        .select('cnpj, id')
        .eq('distribuidor_id', distribuidorId!)
      if (errC) throw errC

      const clientePorCnpj = new Map(
        (clientes ?? []).map((c) => [normalizaCnpj(c.cnpj), c.id] as const)
      )

      const universo: Array<{
        cnpj: string
        nome_fantasia: string | null
        razao_social: string | null
        bairro: string | null
        cnae_principal: string | null
        latitude: number | null
        longitude: number | null
        nivel_geocodificacao: string | null
      }> = []

      for (let from = 0; ; from += 1000) {
        let q = supabase
          .from('alwayson_pdv_universo')
          .select(
            'cnpj, nome_fantasia, razao_social, bairro, cnae_principal, latitude, longitude, nivel_geocodificacao'
          )
        if (codigoIbge != null) q = q.eq('codigo_ibge', codigoIbge)
        const { data, error } = await q.range(from, from + 999)
        if (error) throw error
        if (!data?.length) break
        universo.push(...(data as typeof universo))
        if (data.length < 1000) break
      }

      const candidatos = universo.filter((u) => {
        if (desconsiderados.has(u.cnpj)) return false
        if (bairroCoberturaLabel(u.bairro) !== grupo!.bairro) return false
        return labelCnaeGrupo(u.cnae_principal) === grupo!.cnae_grupo
      })

      const scoreMap = new Map<string, { indice: number; faixa: string | null }>()
      const cnps = candidatos.map((u) => u.cnpj)
      for (let i = 0; i < cnps.length; i += 500) {
        const { data, error } = await supabase
          .from('alwayson_pdv_score')
          .select('cnpj, potencial_estimado_mensal, faixa')
          .eq('versao_modelo', EXPLORAR_VERSAO_MODELO)
          .in('cnpj', cnps.slice(i, i + 500))
        if (error) throw error
        for (const s of data ?? []) {
          scoreMap.set(s.cnpj, {
            indice: Number(s.potencial_estimado_mensal) || 0,
            faixa: s.faixa ?? null,
          })
        }
      }

      const FAIXA_ORDEM: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 }

      return candidatos
        .map((u) => {
          const score = scoreMap.get(u.cnpj)
          if (!score) return null
          const clienteId = clientePorCnpj.get(u.cnpj) ?? null
          return {
            cnpj: u.cnpj,
            nome: nomePdv(u.nome_fantasia, u.razao_social),
            segmento_cnae: labelSegmentoCnae(u.cnae_principal),
            cnae_principal: u.cnae_principal,
            indice_relevancia: score.indice,
            faixa: score.faixa,
            atendido: clienteId != null,
            cliente_id: clienteId,
            latitude: u.latitude,
            longitude: u.longitude,
            nivel_geocodificacao: (u.nivel_geocodificacao ??
              null) as PdvCoberturaDetalheRow['nivel_geocodificacao'],
            geo_mapa: pdvPlotavelMapa(u.latitude, u.longitude, u.nivel_geocodificacao),
          }
        })
        .filter((r): r is PdvCoberturaDetalheRow => r != null)
        .sort((a, b) => {
          if (a.atendido !== b.atendido) return a.atendido ? 1 : -1
          const fa = FAIXA_ORDEM[a.faixa ?? ''] ?? 9
          const fb = FAIXA_ORDEM[b.faixa ?? ''] ?? 9
          if (fa !== fb) return fa - fb
          return b.indice_relevancia - a.indice_relevancia
        })
    },
  })
}

export function useExplorarMapa(
  distribuidorId: string | undefined,
  fornecedorTenantId: string | undefined,
  codigoIbge?: number | null
) {
  return useQuery({
    queryKey: [
      'explorar-mapa',
      distribuidorId,
      fornecedorTenantId,
      EXPLORAR_VERSAO_MODELO,
      codigoIbge ?? 'all',
    ],
    enabled: !!distribuidorId && !!fornecedorTenantId,
    queryFn: async (): Promise<PdvMapaPonto[]> => {
      const desconsiderados = await carregarPdvDesconsideradosSet()

      const { data: clientes, error: errC } = await supabase
        .from('alwayson_clientes_distribuidor')
        .select('cnpj, id')
        .eq('distribuidor_id', distribuidorId!)
      if (errC) throw errC

      const atendidos = new Set((clientes ?? []).map((c) => normalizaCnpj(c.cnpj)))
      const clientePorCnpj = new Map(
        (clientes ?? []).map((c) => [normalizaCnpj(c.cnpj), c.id] as const)
      )

      const universo: Array<{
        cnpj: string
        nome_fantasia: string | null
        razao_social: string | null
        latitude: number
        longitude: number
        nivel_geocodificacao: string | null
        bairro: string | null
        cnae_principal: string | null
      }> = []

      for (let from = 0; ; from += 1000) {
        let q = supabase
          .from('alwayson_pdv_universo')
          .select(
            'cnpj, nome_fantasia, razao_social, latitude, longitude, nivel_geocodificacao, bairro, cnae_principal'
          )
          .not('latitude', 'is', null)
          .not('longitude', 'is', null)
        if (codigoIbge != null) q = q.eq('codigo_ibge', codigoIbge)
        const { data, error } = await q.range(from, from + 999)
        if (error) throw error
        if (!data?.length) break
        universo.push(...(data as typeof universo))
        if (data.length < 1000) break
      }

      const scoreMap = new Map<
        string,
        { indice: number; qtdRede: number | null; faixa: string | null }
      >()
      const cnps = universo.map((u) => u.cnpj)
      for (let i = 0; i < cnps.length; i += 500) {
        const { data, error } = await supabase
          .from('alwayson_pdv_score')
          .select('cnpj, potencial_estimado_mensal, faixa, features')
          .eq('versao_modelo', EXPLORAR_VERSAO_MODELO)
          .in('cnpj', cnps.slice(i, i + 500))
        if (error) throw error
        for (const s of data ?? []) {
          scoreMap.set(s.cnpj, {
            indice: Number(s.potencial_estimado_mensal) || 0,
            qtdRede:
              (s.features as { qtd_estabelecimentos_raiz?: number } | null)
                ?.qtd_estabelecimentos_raiz ?? null,
            faixa: s.faixa ?? null,
          })
        }
      }

      const pontos: PdvMapaPonto[] = []
      for (const row of universo) {
        if (desconsiderados.has(row.cnpj)) continue
        if (!geoConfiavelMapa(row.nivel_geocodificacao)) continue
        const score = scoreMap.get(row.cnpj)
        if (!score) continue
        pontos.push({
          cnpj: row.cnpj,
          latitude: row.latitude,
          longitude: row.longitude,
          nome: nomePdv(row.nome_fantasia, row.razao_social),
          indice_relevancia: score.indice,
          atendido: atendidos.has(row.cnpj),
          nivel_geocodificacao: row.nivel_geocodificacao as PdvMapaPonto['nivel_geocodificacao'],
          bairro: row.bairro,
          qtd_lojas_rede: score.qtdRede,
          cnae_principal: row.cnae_principal,
          segmento_cnae: labelSegmentoCnae(row.cnae_principal),
          faixa: score.faixa,
          cliente_id: clientePorCnpj.get(row.cnpj) ?? null,
        })
      }

      return pontos
    },
  })
}

export function useExplorarResumo(
  cobertura: PdvCoberturaRow[] | undefined,
  prioridade: PdvPrioridadeRow[] | undefined
): PdvResumo | null {
  if (!cobertura) return null
  const qualificados = cobertura.reduce((s, r) => s + r.qtd_qualificados, 0)
  const atendidos = cobertura.reduce((s, r) => s + r.qtd_atendidos, 0)
  const potencialNaoAtendido = cobertura.reduce(
    (s, r) => s + (Number(r.potencial_nao_atendido) || 0),
    0
  )
  const subexplorados =
    prioridade?.filter((p) => p.atendido && p.segmento === 'subexplorado').length ?? 0
  const oportunidadesAb =
    prioridade?.filter(
      (p) => !p.atendido && (p.faixa === 'A' || p.faixa === 'B')
    ).length ?? 0

  return {
    qualificados,
    atendidos,
    coberturaPct: qualificados > 0 ? Number(((atendidos / qualificados) * 100).toFixed(2)) : null,
    relevanciaNaoAtendida: potencialNaoAtendido,
    subexplorados,
    oportunidadesAb,
  }
}
