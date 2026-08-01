import {
  cellStr,
  codigoProdutoVariants,
  missingColumns,
  parseDateCell,
  parseDocumento,
  parseNumber,
  pick,
  readSheetRows,
} from './sheet.mjs'
import {
  isCidadeVazia,
  normalizeCnpjDigits,
  resolveClienteCidadesBatch,
} from './resolve-cliente-cidade.mjs'

const REQUIRED = [
  'data_venda',
  'numero_nf',
  'cnpj_cliente',
  'sku',
  'quantidade',
  'valor_unitario',
  'valor_total',
]

const ALIASES = {
  data_venda: ['data', 'data_emissao'],
  cnpj_cliente: ['cnpj'],
  sku: ['codigo_produto', 'cod_produto'],
  descricao_produto: ['descricao', 'produto'],
  nome_cliente: ['nome_fantasia'],
  razao_social: ['razao'],
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ buffer: Buffer, distribuidorId: string }} args
 */
export async function processVendas(supabase, { buffer, distribuidorId, fornecedorTenantId }) {
  const { headers, rows } = readSheetRows(buffer)
  const missing = missingColumns(headers, REQUIRED, ALIASES)
  if (missing.length) {
    const err = new Error(`Colunas obrigatórias ausentes: ${missing.join(', ')}`)
    err.code = 'formato_invalido'
    err.status = 422
    throw err
  }

  const warnings = []
  /** @type {Map<string, any>} */
  const groups = new Map()

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const lineNo = i + 2
    const data_venda = parseDateCell(pick(row, 'data_venda', ALIASES.data_venda))
    const numero_nf = cellStr(pick(row, 'numero_nf'))
    const cnpj = parseDocumento(pick(row, 'cnpj_cliente', ALIASES.cnpj_cliente))
    const razao = cellStr(pick(row, 'razao_social', ALIASES.razao_social))
    const nome = cellStr(pick(row, 'nome_cliente', ALIASES.nome_cliente)) || razao
    const cod_vend = cellStr(pick(row, 'codigo_vendedor'))
    const nome_vend = cellStr(pick(row, 'nome_vendedor')) || (cod_vend ? `Vendedor ${cod_vend}` : '')
    const cod_sup = cellStr(pick(row, 'codigo_supervisor'))
    const nome_sup = cellStr(pick(row, 'nome_supervisor')) || (cod_sup ? `Supervisor ${cod_sup}` : '')
    const cod_ger = cellStr(pick(row, 'codigo_gerente'))
    const nome_ger = cellStr(pick(row, 'nome_gerente')) || (cod_ger ? `Gerente ${cod_ger}` : '')
    const skuRaw = cellStr(pick(row, 'sku', ALIASES.sku))
    const descricao = cellStr(pick(row, 'descricao_produto', ALIASES.descricao_produto)) || skuRaw
    const quantidade = parseNumber(pick(row, 'quantidade'))
    const unidade = cellStr(pick(row, 'unidade')) || 'UN'
    const valor_unitario = parseNumber(pick(row, 'valor_unitario'))
    const valor_total = parseNumber(pick(row, 'valor_total'))

    if (
      !data_venda ||
      !numero_nf ||
      !cnpj ||
      !skuRaw ||
      quantidade == null ||
      valor_unitario == null ||
      valor_total == null
    ) {
      warnings.push(`Linha ${lineNo}: campos obrigatórios inválidos — ignorada`)
      continue
    }
    if (!cod_vend || !nome_vend) {
      warnings.push(`Linha ${lineNo}: vendedor ausente — ignorada`)
      continue
    }
    if (!razao && !nome) {
      warnings.push(`Linha ${lineNo}: razão/nome cliente ausente — ignorada`)
      continue
    }

    let g = groups.get(numero_nf)
    if (!g) {
      g = {
        data_venda,
        cnpj,
        razao: razao || nome,
        nome: nome || razao,
        cod_vend,
        nome_vend,
        cod_sup,
        nome_sup,
        cod_ger,
        nome_ger,
        itens: [],
      }
      groups.set(numero_nf, g)
    } else {
      const divergencias = []
      if (g.data_venda !== data_venda) divergencias.push('data_venda')
      if (g.cnpj !== cnpj) divergencias.push('cnpj_cliente')
      if ((g.razao || '') !== (razao || nome)) divergencias.push('razao_social')
      if (g.cod_vend !== cod_vend) divergencias.push('codigo_vendedor')
      if (divergencias.length) {
        warnings.push(
          `NF ${numero_nf} linha ${lineNo}: divergência (${divergencias.join(', ')}) — ignorada`
        )
        continue
      }
    }

    g.itens.push({ skuRaw, descricao, quantidade, unidade, valor_unitario, valor_total })
  }

  if (!groups.size) {
    const err = new Error('Nenhuma linha válida de vendas no arquivo')
    err.code = 'formato_invalido'
    err.status = 422
    err.erros = warnings
    throw err
  }

  const { data: deParaRows, error: deParaErr } = await supabase
    .from('alwayson_distribuidor_produto_de_para')
    .select('codigo_cliente, sku_fornecedor')
    .eq('distribuidor_id', distribuidorId)
    .eq('ativo', true)
  if (deParaErr) throw deParaErr

  /** @type {Map<string, string>} */
  const dePara = new Map()
  for (const r of deParaRows ?? []) {
    const skuForn = String(r.sku_fornecedor).trim()
    for (const v of codigoProdutoVariants(String(r.codigo_cliente))) {
      dePara.set(v, skuForn)
    }
  }

  const skusNeeded = new Set()
  const skusSemDePara = new Set()
  for (const g of groups.values()) {
    for (const it of g.itens) {
      let resolved = null
      for (const v of codigoProdutoVariants(it.skuRaw)) {
        if (dePara.has(v)) {
          resolved = dePara.get(v)
          break
        }
      }
      if (!resolved) {
        skusSemDePara.add(it.skuRaw)
        resolved = it.skuRaw
      }
      it.sku = resolved
      skusNeeded.add(resolved)
    }
  }
  if (dePara.size > 0) {
    for (const s of skusSemDePara) {
      warnings.push(`SKU sem de-para: ${s} (gravado como está)`)
    }
  }

  const { data: produtos, error: prodErr } = await supabase
    .from('alwayson_produtos')
    .select('id, sku')
    .in('sku', [...skusNeeded])
  if (prodErr) throw prodErr
  const produtoBySku = new Map((produtos ?? []).map((p) => [p.sku, p.id]))

  // --- Hierarquia em lote ---
  const { data: existingVend, error: vendLoadErr } = await supabase
    .from('alwayson_vendedores_distribuidor')
    .select('id, tipo, codigo_externo, nome')
    .eq('distribuidor_id', distribuidorId)
  if (vendLoadErr) throw vendLoadErr

  /** @type {Map<string, { id: string, nome: string }>} */
  const vendByKey = new Map()
  for (const v of existingVend ?? []) {
    if (v.codigo_externo) vendByKey.set(`${v.tipo}|${v.codigo_externo}`, { id: v.id, nome: v.nome })
  }

  /** @type {Map<string, { tipo: string, codigo: string, nome: string, supervisorKey: string|null }>} */
  const neededPeople = new Map()
  for (const g of groups.values()) {
    if (g.cod_ger) {
      neededPeople.set(`gerente|${g.cod_ger}`, {
        tipo: 'gerente',
        codigo: g.cod_ger,
        nome: g.nome_ger,
        supervisorKey: null,
      })
    }
    if (g.cod_sup) {
      neededPeople.set(`supervisor|${g.cod_sup}`, {
        tipo: 'supervisor',
        codigo: g.cod_sup,
        nome: g.nome_sup,
        supervisorKey: g.cod_ger ? `gerente|${g.cod_ger}` : null,
      })
    }
    neededPeople.set(`vendedor|${g.cod_vend}`, {
      tipo: 'vendedor',
      codigo: g.cod_vend,
      nome: g.nome_vend,
      supervisorKey: g.cod_sup ? `supervisor|${g.cod_sup}` : null,
    })
  }

  // Insert missing in order: gerente → supervisor → vendedor
  for (const tipo of ['gerente', 'supervisor', 'vendedor']) {
    const toInsert = []
    for (const [key, p] of neededPeople) {
      if (p.tipo !== tipo) continue
      if (vendByKey.has(key)) continue
      let supervisor_id = null
      if (p.supervisorKey && vendByKey.has(p.supervisorKey)) {
        supervisor_id = vendByKey.get(p.supervisorKey).id
      }
      toInsert.push({
        distribuidor_id: distribuidorId,
        nome: p.nome,
        tipo: p.tipo,
        codigo_externo: p.codigo,
        supervisor_id,
        ativo: true,
        _key: key,
      })
    }
    if (!toInsert.length) continue
    const payload = toInsert.map(({ _key, ...rest }) => rest)
    const { data: created, error } = await supabase
      .from('alwayson_vendedores_distribuidor')
      .insert(payload)
      .select('id, tipo, codigo_externo, nome')
    if (error) throw error
    for (const v of created ?? []) {
      vendByKey.set(`${v.tipo}|${v.codigo_externo}`, { id: v.id, nome: v.nome })
    }
  }

  // Patch supervisor_id for people that existed before their parent
  const patchSup = []
  for (const [key, p] of neededPeople) {
    if (!p.supervisorKey) continue
    const me = vendByKey.get(key)
    const parent = vendByKey.get(p.supervisorKey)
    if (me && parent) patchSup.push({ id: me.id, supervisor_id: parent.id, nome: p.nome })
  }
  for (const chunk of chunkArr(patchSup, 50)) {
    await Promise.all(
      chunk.map((p) =>
        supabase
          .from('alwayson_vendedores_distribuidor')
          .update({ supervisor_id: p.supervisor_id, nome: p.nome, ativo: true })
          .eq('id', p.id)
      )
    )
  }

  // --- Clientes em lote ---
  const cnpjs = [...new Set([...groups.values()].map((g) => g.cnpj))]
  const { data: existingClientes, error: cliLoadErr } = await supabase
    .from('alwayson_clientes_distribuidor')
    .select('id, cnpj, cidade, estado')
    .eq('distribuidor_id', distribuidorId)
    .in('cnpj', cnpjs)
  if (cliLoadErr) throw cliLoadErr

  const clienteByCnpj = new Map((existingClientes ?? []).map((c) => [c.cnpj, c.id]))
  const existingByCnpj = new Map((existingClientes ?? []).map((c) => [c.cnpj, c]))

  const cnpjsSemCidade = cnpjs.filter((cnpj) => {
    const ex = existingByCnpj.get(cnpj)
    return !ex || isCidadeVazia(ex.cidade, ex.estado)
  })

  const cidadesResolvidas = await resolveClienteCidadesBatch(supabase, cnpjsSemCidade, {
    onWarning: (msg) => warnings.push(msg),
  })

  /** @type {Map<string, any>} */
  const clientePayloadByCnpj = new Map()
  for (const g of groups.values()) {
    const vendedorId = vendByKey.get(`vendedor|${g.cod_vend}`)?.id
    if (!vendedorId) {
      warnings.push(`Vendedor ${g.cod_vend} não resolvido`)
      continue
    }
    const resolved = cidadesResolvidas.get(normalizeCnpjDigits(g.cnpj))
    clientePayloadByCnpj.set(g.cnpj, {
      distribuidor_id: distribuidorId,
      cnpj: g.cnpj,
      razao_social: g.razao,
      nome_fantasia: g.nome,
      cidade: resolved?.cidade ?? '—',
      estado: resolved?.estado ?? '—',
      vendedor_id: vendedorId,
      status: 'ativo',
      atualizado_em: new Date().toISOString(),
    })
  }

  const toUpdateCli = []
  const toInsertCli = []
  const toBackfillCidade = []
  for (const [cnpj, payload] of clientePayloadByCnpj) {
    const existing = existingByCnpj.get(cnpj)
    if (existing) {
      const { cidade, estado, ...rest } = payload
      toUpdateCli.push({ id: existing.id, ...rest })
      if (isCidadeVazia(existing.cidade, existing.estado) && !isCidadeVazia(cidade, estado)) {
        toBackfillCidade.push({ id: existing.id, cidade, estado, geo_enriquecido_em: new Date().toISOString() })
      }
    } else {
      toInsertCli.push(payload)
    }
  }

  for (const chunk of chunkArr(toUpdateCli, 40)) {
    await Promise.all(
      chunk.map(({ id, ...payload }) =>
        supabase.from('alwayson_clientes_distribuidor').update(payload).eq('id', id)
      )
    )
  }

  for (const chunk of chunkArr(toBackfillCidade, 40)) {
    await Promise.all(
      chunk.map(({ id, ...payload }) =>
        supabase.from('alwayson_clientes_distribuidor').update(payload).eq('id', id)
      )
    )
  }

  for (const chunk of chunkArr(toInsertCli, 100)) {
    const { data: created, error } = await supabase
      .from('alwayson_clientes_distribuidor')
      .insert(chunk)
      .select('id, cnpj')
    if (error) throw error
    for (const c of created ?? []) clienteByCnpj.set(c.cnpj, c.id)
  }

  // --- Faturamento: substitui NFs do arquivo ---
  const numerosNf = [...groups.keys()]
  for (const chunk of chunkArr(numerosNf, 100)) {
    const { data: existingFat, error } = await supabase
      .from('alwayson_faturamento')
      .select('id')
      .eq('distribuidor_id', distribuidorId)
      .in('numero_nf', chunk)
    if (error) throw error
    const ids = (existingFat ?? []).map((f) => f.id)
    if (ids.length) {
      const { error: delErr } = await supabase.from('alwayson_faturamento').delete().in('id', ids)
      if (delErr) throw delErr
    }
  }

  /** @type {any[]} */
  const fatRows = []
  /** @type {string[]} */
  const fatNfOrder = []
  for (const [numero_nf, g] of groups) {
    const cliente_id = clienteByCnpj.get(g.cnpj)
    const vendedor_id = vendByKey.get(`vendedor|${g.cod_vend}`)?.id
    if (!cliente_id || !vendedor_id) {
      warnings.push(`NF ${numero_nf}: cliente/vendedor não resolvido — pulada`)
      continue
    }
    const valor_total = g.itens.reduce((s, it) => s + Number(it.valor_total), 0)
    fatRows.push({
      distribuidor_id: distribuidorId,
      // Segundo eixo do dado (migration 047): o arquivo é sempre o recorte de
      // um fornecedor dentro de um distribuidor.
      fornecedor_tenant_id: fornecedorTenantId,
      cliente_id,
      vendedor_id,
      numero_nf,
      data_emissao: g.data_venda,
      valor_total,
    })
    fatNfOrder.push(numero_nf)
  }

  /** @type {Map<string, string>} */
  const fatIdByNf = new Map()
  for (const chunk of chunkArr(
    fatRows.map((r, i) => ({ ...r, _nf: fatNfOrder[i] })),
    80
  )) {
    const payload = chunk.map(({ _nf, ...rest }) => rest)
    const { data: created, error } = await supabase
      .from('alwayson_faturamento')
      .insert(payload)
      .select('id, numero_nf')
    if (error) throw error
    for (const f of created ?? []) fatIdByNf.set(f.numero_nf, f.id)
  }

  /** @type {any[]} */
  const itemRows = []
  for (const [numero_nf, g] of groups) {
    const faturamento_id = fatIdByNf.get(numero_nf)
    if (!faturamento_id) continue
    for (const it of g.itens) {
      itemRows.push({
        faturamento_id,
        produto_id: produtoBySku.get(it.sku) ?? null,
        sku: it.sku,
        descricao: it.descricao,
        quantidade: it.quantidade,
        valor_unitario: it.valor_unitario,
        valor_total: it.valor_total,
        unidade: it.unidade,
      })
    }
  }

  for (const chunk of chunkArr(itemRows, 200)) {
    const { error } = await supabase.from('alwayson_faturamento_itens').insert(chunk)
    if (error) throw error
  }

  return {
    registros_processados: itemRows.length,
    detalhes: {
      nfs: fatIdByNf.size,
      itens: itemRows.length,
      avisos: [...new Set(warnings)].slice(0, 50),
    },
  }
}

/** @template T @param {T[]} arr @param {number} size */
function chunkArr(arr, size) {
  /** @type {T[][]} */
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}
