import {
  cellStr,
  codigoProdutoVariants,
  missingColumns,
  parseNumber,
  pick,
  readSheetRows,
} from './sheet.mjs'

const REQUIRED = ['sku', 'quantidade_estoque']
const ALIASES = {
  quantidade_estoque: ['quantidade', 'qtd', 'quantidade_atual'],
  descricao: ['descricao_produto', 'produto'],
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ buffer: Buffer, distribuidorId: string }} args
 */
export async function processEstoque(supabase, { buffer, distribuidorId }) {
  const { headers, rows } = readSheetRows(buffer)
  const missing = missingColumns(headers, REQUIRED, ALIASES)
  if (missing.length) {
    const err = new Error(`Colunas obrigatórias ausentes: ${missing.join(', ')}`)
    err.code = 'formato_invalido'
    err.status = 422
    throw err
  }

  const { data: deParaRows } = await supabase
    .from('alwayson_distribuidor_produto_de_para')
    .select('codigo_cliente, sku_fornecedor')
    .eq('distribuidor_id', distribuidorId)
    .eq('ativo', true)

  /** @type {Map<string, string>} */
  const dePara = new Map()
  for (const r of deParaRows ?? []) {
    const skuForn = String(r.sku_fornecedor).trim()
    for (const v of codigoProdutoVariants(String(r.codigo_cliente))) {
      dePara.set(v, skuForn)
    }
  }

  function resolveSku(skuRaw) {
    for (const v of codigoProdutoVariants(skuRaw)) {
      if (dePara.has(v)) return dePara.get(v)
    }
    return skuRaw
  }

  /** @type {Map<string, { sku: string, descricao: string, quantidade: number }>} */
  const bySku = new Map()
  const warnings = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const skuRaw = cellStr(pick(row, 'sku'))
    const qtd = parseNumber(pick(row, 'quantidade_estoque', ALIASES.quantidade_estoque))
    const descricao = cellStr(pick(row, 'descricao', ALIASES.descricao)) || skuRaw
    if (!skuRaw || qtd == null) {
      warnings.push(`Linha ${i + 2}: sku/quantidade inválidos`)
      continue
    }
    const sku = resolveSku(skuRaw)
    bySku.set(sku, { sku, descricao, quantidade: qtd })
  }

  if (!bySku.size) {
    const err = new Error('Nenhuma linha válida de estoque')
    err.code = 'formato_invalido'
    err.status = 422
    throw err
  }

  let count = 0
  for (const item of bySku.values()) {
    const { data: existing } = await supabase
      .from('alwayson_estoque_distribuidor')
      .select('id')
      .eq('distribuidor_id', distribuidorId)
      .eq('sku', item.sku)
      .maybeSingle()

    const payload = {
      distribuidor_id: distribuidorId,
      sku: item.sku,
      descricao: item.descricao,
      quantidade_atual: item.quantidade,
      ultima_atualizacao: new Date().toISOString(),
      status: item.quantidade > 0 ? 'ok' : 'zerado',
    }

    if (existing?.id) {
      const { error } = await supabase
        .from('alwayson_estoque_distribuidor')
        .update(payload)
        .eq('id', existing.id)
      if (error) throw error
    } else {
      const { error } = await supabase.from('alwayson_estoque_distribuidor').insert(payload)
      if (error) throw error
    }
    count += 1
  }

  return {
    registros_processados: count,
    detalhes: { avisos: [...new Set(warnings)].slice(0, 50) },
  }
}
