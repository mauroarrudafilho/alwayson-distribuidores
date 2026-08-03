import { labelCnaeGrupo } from './cnae-grupo.mjs'
import {
  calcularGap,
  calcularPercentualPotencial,
  classificarSegmento,
  medianaCompraCarteiraAb,
} from './segmento.mjs'
import { VERSAO_MODELO_V1 } from './score-v1.mjs'

export function normalizaCnpj(raw) {
  const d = String(raw ?? '').replace(/\D/g, '')
  return d.length >= 14 ? d.slice(0, 14) : d.padStart(14, '0')
}

export async function carregarFornecedorAtivo(supabase, distribuidorId) {
  const { data, error } = await supabase
    .from('alwayson_fornecedor_distribuidores')
    .select('fornecedor_tenant_id')
    .eq('distribuidor_id', distribuidorId)
    .eq('ativo', true)
  if (error) throw error
  if (!data?.length) throw new Error(`Nenhum fornecedor ativo para distribuidor ${distribuidorId}`)
  if (data.length > 1) {
    console.warn('[cruzamento] múltiplos fornecedores ativos — usando o primeiro')
  }
  return data[0].fornecedor_tenant_id
}

export async function carregarDesconsiderados(supabase) {
  const set = new Set()
  try {
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from('alwayson_pdv_desconsiderados')
        .select('cnpj')
        .range(from, from + 999)
      if (error) throw error
      if (!data?.length) break
      for (const r of data) set.add(normalizaCnpj(r.cnpj))
      if (data.length < 1000) break
    }
  } catch (err) {
    const msg = String(err?.message ?? err)
    if (msg.includes('alwayson_pdv_desconsiderados')) {
      console.warn('[pdv] alwayson_pdv_desconsiderados ausente — aplique docs/migrations/057')
      return set
    }
    throw err
  }
  return set
}

export async function carregarUniversoComScore(supabase, codigosIbge, versaoModelo) {
  const universo = []
  for (const codigo of codigosIbge) {
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from('alwayson_pdv_universo')
        .select('cnpj, uf, municipio, bairro, codigo_ibge, cnae_principal')
        .eq('codigo_ibge', codigo)
        .range(from, from + 999)
      if (error) throw error
      if (!data?.length) break
      universo.push(...data)
      if (data.length < 1000) break
    }
  }

  const scoreMap = new Map()
  const cnps = universo.map((u) => u.cnpj)
  for (let i = 0; i < cnps.length; i += 500) {
    const { data, error } = await supabase
      .from('alwayson_pdv_score')
      .select('cnpj, faixa, potencial_estimado_mensal')
      .eq('versao_modelo', versaoModelo)
      .in('cnpj', cnps.slice(i, i + 500))
    if (error) throw error
    for (const s of data ?? []) scoreMap.set(s.cnpj, s)
  }

  return universo
    .map((u) => {
      const score = scoreMap.get(u.cnpj)
      if (!score) return null
      return {
        ...u,
        bairro: u.bairro ?? '',
        faixa: score.faixa,
        potencial_estimado_mensal: score.potencial_estimado_mensal,
      }
    })
    .filter(Boolean)
}

/** Universo com score, excluindo CNPJs desconsiderados. */
export async function carregarUniversoComScoreFiltrado(supabase, codigosIbge, versaoModelo) {
  const [universo, desconsiderados] = await Promise.all([
    carregarUniversoComScore(supabase, codigosIbge, versaoModelo),
    carregarDesconsiderados(supabase),
  ])
  if (!desconsiderados.size) return universo
  return universo.filter((u) => !desconsiderados.has(u.cnpj))
}

export async function carregarClientes(supabase, distribuidorId) {
  const map = new Map()
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('alwayson_clientes_distribuidor')
      .select('id, cnpj, vendedor_id')
      .eq('distribuidor_id', distribuidorId)
      .range(from, from + 999)
    if (error) throw error
    if (!data?.length) break
    for (const c of data) {
      map.set(normalizaCnpj(c.cnpj), c)
    }
    if (data.length < 1000) break
  }
  return map
}

export async function carregarCompraMediaPorCliente(
  supabase,
  distribuidorId,
  fornecedorTenantId,
  mesesJanela = 12
) {
  const desde = new Date()
  desde.setMonth(desde.getMonth() - mesesJanela)
  const desdeStr = desde.toISOString().slice(0, 10)

  const totals = new Map()
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('alwayson_faturamento')
      .select('cliente_id, valor_total, data_emissao')
      .eq('distribuidor_id', distribuidorId)
      .eq('fornecedor_tenant_id', fornecedorTenantId)
      .gte('data_emissao', desdeStr)
      .range(from, from + 999)
    if (error) throw error
    if (!data?.length) break
    for (const f of data) {
      if (!f.cliente_id) continue
      const mes = String(f.data_emissao).slice(0, 7)
      let row = totals.get(f.cliente_id)
      if (!row) {
        row = { total: 0, meses: new Set() }
        totals.set(f.cliente_id, row)
      }
      row.total += Number(f.valor_total) || 0
      row.meses.add(mes)
    }
    if (data.length < 1000) break
  }

  const out = new Map()
  for (const [clienteId, row] of totals) {
    const nMeses = Math.max(1, row.meses.size)
    out.set(clienteId, Number((row.total / nMeses).toFixed(2)))
  }
  return out
}

export function montarPrioridades({
  universo,
  clientesPorCnpj,
  compraPorClienteId,
  distribuidorId,
  fornecedorTenantId,
  versaoModelo = VERSAO_MODELO_V1,
}) {
  const medianaCompraAb = medianaCompraCarteiraAb(universo, clientesPorCnpj, compraPorClienteId)
  const rows = []
  for (const u of universo) {
    const cliente = clientesPorCnpj.get(u.cnpj)
    if (!cliente) continue

    const compra = compraPorClienteId.get(cliente.id) ?? 0
    const indice = u.potencial_estimado_mensal ?? 0
    const segmento = classificarSegmento({
      faixa: u.faixa,
      compraMedia: compra,
      medianaCompraAb,
    })

    rows.push({
      distribuidor_id: distribuidorId,
      fornecedor_tenant_id: fornecedorTenantId,
      cnpj: u.cnpj,
      cliente_id: cliente.id,
      versao_modelo: versaoModelo,
      segmento,
      potencial_estimado_mensal: indice,
      compra_media_mensal: compra,
      gap_reais: calcularGap(indice, compra, medianaCompraAb, u.faixa),
      percentual_do_potencial: calcularPercentualPotencial(
        indice,
        compra,
        medianaCompraAb,
        u.faixa
      ),
      vendedor_id: cliente.vendedor_id,
      calculado_em: new Date().toISOString(),
    })
  }

  for (const u of universo) {
    if (clientesPorCnpj.has(u.cnpj)) continue
    const indice = u.potencial_estimado_mensal ?? 0
    rows.push({
      distribuidor_id: distribuidorId,
      fornecedor_tenant_id: fornecedorTenantId,
      cnpj: u.cnpj,
      cliente_id: null,
      versao_modelo: versaoModelo,
      segmento: 'nao_atendido',
      potencial_estimado_mensal: indice,
      compra_media_mensal: null,
      gap_reais: null,
      percentual_do_potencial: null,
      vendedor_id: null,
      calculado_em: new Date().toISOString(),
    })
  }

  return rows
}

export function montarCobertura({
  universo,
  clientesPorCnpj,
  distribuidorId,
  fornecedorTenantId,
}) {
  const atendidos = new Set(clientesPorCnpj.keys())
  const grupos = new Map()

  for (const u of universo) {
    const cnaeGrupo = labelCnaeGrupo(u.cnae_principal)
    const bairro = (u.bairro ?? '').trim() || '(sem bairro)'
    const key = `${u.uf}|${u.municipio}|${bairro}|${cnaeGrupo}`

    let g = grupos.get(key)
    if (!g) {
      g = {
        distribuidor_id: distribuidorId,
        fornecedor_tenant_id: fornecedorTenantId,
        uf: u.uf,
        municipio: u.municipio,
        bairro,
        cnae_grupo: cnaeGrupo,
        codigo_ibge: u.codigo_ibge,
        qtd_qualificados: 0,
        qtd_atendidos: 0,
        potencial_nao_atendido: 0,
      }
      grupos.set(key, g)
    }

    g.qtd_qualificados += 1
    const potencial = Number(u.potencial_estimado_mensal) || 0
    if (atendidos.has(u.cnpj)) {
      g.qtd_atendidos += 1
    } else {
      g.potencial_nao_atendido += potencial
    }
  }

  return [...grupos.values()].map((g) => ({
    ...g,
    percentual_cobertura:
      g.qtd_qualificados > 0
        ? Number(((g.qtd_atendidos / g.qtd_qualificados) * 100).toFixed(2))
        : null,
    potencial_nao_atendido: Number(g.potencial_nao_atendido.toFixed(2)),
    calculado_em: new Date().toISOString(),
  }))
}
