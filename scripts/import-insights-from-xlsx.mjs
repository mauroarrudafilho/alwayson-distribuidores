#!/usr/bin/env node
/**
 * Carga inicial de Insights (sell-out territorial) no Supabase a partir de Excel no layout GA/Vendas.
 *
 * Usa SERVICE ROLE (contorna RLS de escrita das tabelas insights).
 *
 * Variáveis (ou use .env / .env.local na raiz do repo):
 *   SUPABASE_URL              — URL do projeto (ex.: https://xxxx.supabase.co)
 *   SUPABASE_SERVICE_ROLE_KEY — chave service_role do dashboard
 *
 * Uso:
 *   node scripts/import-insights-from-xlsx.mjs --file docs/GA_....xlsx --nome "Sell-out GA 2024-2026"
 *   node scripts/import-insights-from-xlsx.mjs --file ... --nome "..." --dry-run
 *
 * Opcionais:
 *   --periodo-inicio YYYY-MM-DD  (default: menor data_venda do arquivo válido)
 *   --periodo-fim YYYY-MM-DD      (default: maior data_venda)
 *   --batch-nfs 80                NF inseridas por request (PostgREST)
 *   --no-geo                      Não grava cidade/UF/lat da BrasilAPI na dimensão cliente. Se a política
 *                                 padrão (só CNPJ ATIVO) estiver ativa, a BrasilAPI ainda é consultada
 *                                 para filtrar. Import sem rede: --no-geo --permitir-cnpj-inativo
 *   --geo-nominatim               Além de cidade/UF, busca lat/lng (bem mais lento)
 *
 * Política de CNPJ (Receita Federal via BrasilAPI):
 *   Por padrão, apenas CNPJs com situação cadastral ATIVA entram no lote.
 *   CNPJs com outra situação (ex.: BAIXADA) são excluídos antes de criar o upload.
 *   Para importar também inativos/baixados: --permitir-cnpj-inativo
 *
 *   --cnpj-list caminho.txt       Restringe o import aos CNPJs listados (14 dígitos, um por linha; # comenta).
 *
 * Linhas com CNPJ inválido / 0 / consumidor final (14 zeros) são descartadas
 * — mesma política que src/lib/insightsCnpj.ts
 */

/* eslint-disable no-console -- CLI */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

import * as XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'

import { enrichInsightsCnpjBatch, normalizeCnpjDigits } from './lib/insights-cnpj-geo.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

tryLoadDotenv()

const CNPJ_LEN = 14
const RE_SCI = /^-?[\d.]+e[+-]?\d+$/i

function tryLoadDotenv() {
  for (const f of ['.env.local', '.env']) {
    const p = path.join(ROOT, f)
    if (!fs.existsSync(p)) continue
    const text = fs.readFileSync(p, 'utf8')
    for (const line of text.split('\n')) {
      const t = line.trim()
      if (!t || t.startsWith('#')) continue
      const eq = t.indexOf('=')
      if (eq < 1) continue
      const key = t.slice(0, eq).trim()
      let val = t.slice(eq + 1).trim()
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
        val = val.slice(1, -1)
      if (!(key in process.env)) process.env[key] = val
    }
    break
  }
}

/** @typedef {{ ok: true, cnpj14: string } | { ok: false }} ParseCnpj */

/** @returns {ParseCnpj} */
function parseInsightsCnpj(raw) {
  function isAllZeros(d) {
    return d.length === CNPJ_LEN && /^0+$/.test(d)
  }
  function fromNum(round) {
    if (!Number.isSafeInteger(round) || round <= 0) return { ok: false }
    const str = String(round)
    if (str.length > CNPJ_LEN) return { ok: false }
    const padded = str.length < CNPJ_LEN ? str.padStart(CNPJ_LEN, '0') : str
    if (padded.length !== CNPJ_LEN || isAllZeros(padded)) return { ok: false }
    return { ok: true, cnpj14: padded }
  }

  if (raw === null || raw === undefined) return { ok: false }
  if (typeof raw === 'number' && Number.isFinite(raw)) return fromNum(Math.round(raw))
  const s = String(raw).trim()
  if (!s) return { ok: false }
  if (RE_SCI.test(s)) {
    const n = Number(s)
    if (!Number.isFinite(n) || n <= 0) return { ok: false }
    return fromNum(Math.round(n))
  }
  const digits = s.replace(/\D/g, '')
  if (!digits.length) return { ok: false }
  if (digits.length < CNPJ_LEN) {
    const padded = digits.padStart(CNPJ_LEN, '0')
    if (isAllZeros(padded)) return { ok: false }
    return { ok: true, cnpj14: padded }
  }
  if (digits.length > CNPJ_LEN || isAllZeros(digits)) return { ok: false }
  if (!/^\d{14}$/.test(digits)) return { ok: false }
  return { ok: true, cnpj14: digits }
}

function normalizeHeader(h) {
  return String(h ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, '_')
}

/** Excel serial 1900 (Windows, planilhas GA típicas) → YYYY-MM-DD (calendário UTC do serial, sem deslocar mês). */
function excelSerialToIso(serial) {
  const epochUtc = Date.UTC(1899, 11, 31)
  const ms = epochUtc + Math.round(serial) * 86400000
  const d = new Date(ms)
  if (Number.isNaN(d.getTime())) return null
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Data “de planilha” (cellDates / fuso local) → ISO civil local — evita trocar mês que `toISOString()` UTC causa. */
function dateObjToIsoLocal(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** @returns {string | null} YYYY-MM-DD */
function parseDataVenda(raw) {
  if (raw instanceof Date && !Number.isNaN(+raw)) return dateObjToIsoLocal(raw)
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 20000 && raw < 100000)
    return excelSerialToIso(raw)
  const s = raw != null ? String(raw).trim() : ''
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s)
  if (m) {
    const dd = m[1].padStart(2, '0')
    const mm = m[2].padStart(2, '0')
    return `${m[3]}-${mm}-${dd}`
  }
  return null
}

function pickCol(map, aliases) {
  for (const a of aliases) {
    const i = map.get(normalizeHeader(a))
    if (typeof i === 'number' && i >= 0) return i
  }
  return -1
}

function num(v, def = null) {
  if (v === '' || v == null) return def
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : def
}

function txt(v) {
  if (v == null) return null
  const s = String(v).trim()
  return s.length ? s : null
}

function parseArgs(argv) {
  let file = ''
  let nome = ''
  let periodoInicio = ''
  let periodoFim = ''
  let dryRun = false
  let batchNfs = 80
  let geoImport = true
  let geoNominatim = false
  let cnpjListFile = ''
  let somenteCnpjAtivos = true

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    const next = () => argv[++i]
    switch (a) {
      case '--file':
        file = path.resolve(next?.() ?? '')
        break
      case '--nome':
        nome = next?.() ?? ''
        break
      case '--periodo-inicio':
        periodoInicio = next?.() ?? ''
        break
      case '--periodo-fim':
        periodoFim = next?.() ?? ''
        break
      case '--dry-run':
        dryRun = true
        break
      case '--batch-nfs':
        batchNfs = Math.max(1, parseInt(String(next?.() ?? '80'), 10) || 80)
        break
      case '--no-geo':
        geoImport = false
        break
      case '--geo-nominatim':
        geoNominatim = true
        break
      case '--cnpj-list':
        cnpjListFile = path.resolve(next?.() ?? '')
        break
      case '--permitir-cnpj-inativo':
        somenteCnpjAtivos = false
        break
      case '--help':
      case '-h':
        console.log(`
Uso:
  node scripts/import-insights-from-xlsx.mjs \\
    --file caminho/arquivo.xlsx \\
    --nome "Descrição do lote"

Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
Flags: --periodo-inicio YYYY-MM-DD --periodo-fim YYYY-MM-DD --dry-run --batch-nfs N
        --no-geo  --geo-nominatim
        --cnpj-list caminho.txt
        --permitir-cnpj-inativo   (importa CNPJs com situação != ATIVA na Receita)
`)
        process.exit(0)
      default:
        break
    }
  }

  return {
    file,
    nome,
    periodoInicio,
    periodoFim,
    dryRun,
    batchNfs,
    geoImport,
    geoNominatim,
    cnpjListFile,
    somenteCnpjAtivos,
  }
}

function chunks(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

/** @param {string} filePath @returns {Set<string>} CNPJs 14 dígitos */
function readCnpjListFile(filePath) {
  const text = fs.readFileSync(filePath, 'utf8')
  const set = new Set()
  for (const line of text.split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const d = normalizeCnpjDigits(t)
    if (d.length === 14) set.add(d)
  }
  return set
}

/** @param {Array<{ numero_nf: string, cnpj14: string, dataIso: string, header: Record<string, string|null>, items: any[] }>} list */
function recomputeItemRange(list) {
  let sumItems = 0
  /** @type {{ min: string, max: string } | null} */
  let range = null
  for (const g of list) {
    sumItems += g.items.length
    const d = g.dataIso
    if (!range) range = { min: d, max: d }
    else {
      if (d < range.min) range.min = d
      if (d > range.max) range.max = d
    }
  }
  return { sumItems, range }
}

/** @param {unknown} a @param {unknown} b */
function pickText(a, b) {
  const norm = (v) => {
    if (v == null) return ''
    const s = String(v).trim()
    return s || ''
  }
  return norm(a) || norm(b) || null
}

/**
 * Linha única por CNPJ na dimensão insights (geo + nome consolidados).
 * @param {string} cnpj14
 * @param {Record<string, string | null>} header
 * @param {Record<string, unknown> | undefined} prev
 * @param {{ ok: boolean, cidade?: string|null, estado?: string|null, lat?: number|null, lng?: number|null, geoTs?: string|null, reason?: string } | undefined} geoR
 * @param {boolean} geoAttempted
 */
function buildInsightsClienteRow(cnpj14, header, prev, geoR, geoAttempted) {
  const nowIso = new Date().toISOString()
  const razao = pickText(header?.razao, prev?.razao_social)
  const nome = pickText(header?.nome_cliente, prev?.nome_cliente)

  let cidade = prev?.cidade != null ? String(prev.cidade) : null
  let estado = prev?.estado != null ? String(prev.estado) : null
  let latRaw = prev?.lat
  let lngRaw = prev?.lng
  let lat = latRaw != null && latRaw !== '' ? Number(latRaw) : null
  let lng = lngRaw != null && lngRaw !== '' ? Number(lngRaw) : null
  let geoTs = prev?.geo_enriquecido_em ?? null
  let motivo = prev?.brasil_api_ultimo_motivo != null ? String(prev.brasil_api_ultimo_motivo) : null
  let tentativa = prev?.brasil_api_ultima_tentativa_em ?? null

  if (geoAttempted && geoR) {
    tentativa = nowIso
    if (geoR.ok) {
      if (geoR.cidade != null) cidade = geoR.cidade
      if (geoR.estado != null) estado = geoR.estado
      if (geoR.lat != null) lat = Number(geoR.lat)
      if (geoR.lng != null) lng = Number(geoR.lng)
      if (geoR.geoTs != null) geoTs = geoR.geoTs
      motivo = null
    } else if (geoR.reason != null) {
      motivo = String(geoR.reason)
    }
  }

  return {
    cnpj_14: cnpj14,
    razao_social: razao,
    nome_cliente: nome,
    cidade,
    estado,
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    geo_enriquecido_em: geoTs,
    brasil_api_ultima_tentativa_em: tentativa,
    brasil_api_ultimo_motivo: motivo,
  }
}

async function main() {
  const {
    file,
    nome,
    periodoInicio: piCli,
    periodoFim: pfCli,
    dryRun,
    batchNfs,
    geoImport,
    geoNominatim,
    cnpjListFile,
    somenteCnpjAtivos,
  } = parseArgs(process.argv)

  if (!file || !nome) {
    console.error('Obrigatório: --file <xlsx> e --nome "...". Use --help.')
    process.exit(1)
  }
  if (!fs.existsSync(file)) {
    console.error('Arquivo não encontrado:', file)
    process.exit(1)
  }
  if (cnpjListFile && !fs.existsSync(cnpjListFile)) {
    console.error('Arquivo --cnpj-list não encontrado:', cnpjListFile)
    process.exit(1)
  }

  const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!dryRun && (!SUPABASE_URL || !SERVICE)) {
    console.error(
      'Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (ou .env.local). --dry-run para só validar o arquivo.'
    )
    process.exit(1)
  }

  const buf = fs.readFileSync(file)
  const wb = XLSX.read(buf, { type: 'buffer', cellDates: true, dense: false })
  const sheetName =
    wb.SheetNames.find((n) => /fat|vf|sell|insights|GA_VGF/i.test(n)) ?? wb.SheetNames[0]
  const ws = wb.Sheets[sheetName]
  if (!ws) {
    console.error('Sem folha legível.')
    process.exit(1)
  }

  const rows = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: '',
    raw: true,
  })

  if (rows.length < 2) {
    console.error('Planilha vazia ou só cabeçalho.')
    process.exit(1)
  }

  const headerCells = rows[0].map((h) => String(h ?? ''))
  const colMap = new Map()
  headerCells.forEach((h, i) => colMap.set(normalizeHeader(h), i))

  const ix = {
    data: pickCol(colMap, ['data_venda', 'data emissão', 'data_emissao']),
    nf: pickCol(colMap, ['numero_nf', 'nf', 'número_nf']),
    cnpj: pickCol(colMap, ['cnpj_cliente', 'cnpj']),
    razao: pickCol(colMap, ['razao_social', 'razão_social']),
    nomeCliente: pickCol(colMap, ['nome_cliente', 'fantasia']),
    cv: pickCol(colMap, ['codigo_vendedor']),
    nv: pickCol(colMap, ['nome_vendedor']),
    cs: pickCol(colMap, ['codigo_supervisor']),
    ns: pickCol(colMap, ['nome_supervisor']),
    cg: pickCol(colMap, ['codigo_gerente']),
    ng: pickCol(colMap, ['nome_gerente']),
    sku: pickCol(colMap, ['sku', 'cod_sku']),
    desc: pickCol(colMap, ['descricao_produto', 'descricao']),
    qty: pickCol(colMap, ['quantidade', 'qtde']),
    un: pickCol(colMap, ['unidade']),
    vu: pickCol(colMap, ['valor_unitario', 'valor unitário']),
    vt: pickCol(colMap, ['valor_total', 'valor total']),
    codEmp: pickCol(colMap, ['cod_emp', 'codemp']),
    nomeEmp: pickCol(colMap, ['nome_emp', 'nomeemp']),
    codprod: pickCol(colMap, ['codprod_fornecedor', 'codprod fornecedor']),
    perfil: pickCol(colMap, ['perfil']),
  }

  if (ix.data < 0 || ix.nf < 0 || ix.cnpj < 0 || ix.sku < 0 || ix.qty < 0 || ix.vt < 0) {
    console.error(
      'Colunas obrigatórias ausentes. Precisa cabeçalhos: data_venda, numero_nf, cnpj_cliente (ou cnpj), sku, quantidade, valor_total'
    )
    console.error(
      'Encontradas (normalizadas):',
      headerCells.map((h, i) => `${i}:${normalizeHeader(h)}`).slice(0, 25),
      headerCells.length > 25 ? '…' : ''
    )
    process.exit(1)
  }

  /** @type {Map<string, { numero_nf: string, cnpj14: string, dataIso: string, header: Record<string, string|null>, items: any[]}>} */
  const groups = new Map()
  let skippedCnpj = 0

  const totalRows = rows.length - 1
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]
    if (!Array.isArray(row) || row.every((c) => c === '' || c == null)) continue

    const cnpjRaw = row[ix.cnpj]
    const p = parseInsightsCnpj(cnpjRaw)
    if (!p.ok) {
      skippedCnpj++
      continue
    }

    const nf = txt(row[ix.nf]) ?? ''
    const dataIso = parseDataVenda(row[ix.data])
    const skuTxt = txt(row[ix.sku]) ?? (row[ix.sku] != null ? String(row[ix.sku]).trim() : '')
    const vt = num(row[ix.vt])
    const qty = num(row[ix.qty])

    if (!nf || !dataIso || !skuTxt || vt == null || qty == null) continue

    const key = `${p.cnpj14}|${nf}`
    let g = groups.get(key)
    if (!g) {
      const headerRow = {}
      headerRow.codigo_vendedor = ix.cv >= 0 ? txt(row[ix.cv]) : null
      headerRow.nome_vendedor = ix.nv >= 0 ? txt(row[ix.nv]) : null
      headerRow.codigo_supervisor = ix.cs >= 0 ? txt(row[ix.cs]) : null
      headerRow.nome_supervisor = ix.ns >= 0 ? txt(row[ix.ns]) : null
      headerRow.codigo_gerente = ix.cg >= 0 ? txt(row[ix.cg]) : null
      headerRow.nome_gerente = ix.ng >= 0 ? txt(row[ix.ng]) : null
      headerRow.razao = ix.razao >= 0 ? txt(row[ix.razao]) : null
      headerRow.nome_cliente = ix.nomeCliente >= 0 ? txt(row[ix.nomeCliente]) : null
      headerRow.cod_emp = ix.codEmp >= 0 ? txt(row[ix.codEmp]) : null
      headerRow.nome_emp = ix.nomeEmp >= 0 ? txt(row[ix.nomeEmp]) : null

      g = {
        numero_nf: nf,
        cnpj14: p.cnpj14,
        dataIso,
        header: headerRow,
        items: [],
      }
      groups.set(key, g)
    } else if (g.dataIso !== dataIso) {
      console.warn(
        `NF ${nf} cliente ${p.cnpj14}: data divergente (${g.dataIso} vs ${dataIso}); mantendo primeira.`
      )
    }

    g.items.push({
      sku: skuTxt,
      descricao: ix.desc >= 0 ? txt(row[ix.desc]) : null,
      quantidade: qty,
      unidade: ix.un >= 0 ? txt(row[ix.un]) : 'UN',
      valor_unitario: ix.vu >= 0 ? num(row[ix.vu]) : null,
      valor_total: vt,
      codprod_fornecedor: ix.codprod >= 0 ? txt(row[ix.codprod]) : null,
      perfil: ix.perfil >= 0 ? txt(row[ix.perfil]) : null,
    })
  }

  let groupList = [...groups.values()]

  if (cnpjListFile) {
    const allowed = readCnpjListFile(cnpjListFile)
    const before = groupList.length
    groupList = groupList.filter((g) => allowed.has(g.cnpj14))
    console.log(
      `Filtro --cnpj-list: ${groupList.length} grupo(s) CNPJ×NF (antes ${before}; ${allowed.size} CNPJ(s) listados).`
    )
    if (!allowed.size) {
      console.error('Nenhum CNPJ válido (14 dígitos) no arquivo --cnpj-list.')
      process.exit(1)
    }
    if (!groupList.length) {
      console.error('Nenhum grupo coincide com os CNPJs do --cnpj-list.')
      process.exit(1)
    }
  }

  let { sumItems, range } = recomputeItemRange(groupList)
  let uniq = [...new Set(groupList.map((g) => g.cnpj14))]

  /** @type {Map<string, { ok: boolean, cidade?: string|null, estado?: string|null, lat?: number|null, lng?: number|null, geoTs?: string|null, reason?: string, cadastro_ativo?: boolean, descricao_situacao_cadastral?: string|null }>} */
  let geoByCnpj = new Map()

  const precisaBrasilApi = Boolean(geoImport || somenteCnpjAtivos)
  if (!geoImport && somenteCnpjAtivos) {
    console.log(
      'Nota: --no-geo só desativa gravação de cidade/UF na dimensão cliente; a BrasilAPI ainda é consultada para manter apenas CNPJs ATIVOS. Sem rede: acrescente --permitir-cnpj-inativo.'
    )
  }
  if (precisaBrasilApi) {
    const modo =
      geoImport && somenteCnpjAtivos
        ? 'BrasilAPI (geo na dimensão cliente + filtro situação ATIVA)'
        : geoImport
          ? 'BrasilAPI (dimensão cliente)'
          : 'BrasilAPI (apenas filtro situação ATIVA; sem atualizar cliente com --no-geo)'
    console.log(
      `${modo}: ${uniq.length} CNPJ(s)` +
        (geoImport && geoNominatim ? ' + Nominatim (~1 req/s).' : '.')
    )
    geoByCnpj = await enrichInsightsCnpjBatch(uniq, {
      useNominatim: Boolean(geoImport && geoNominatim),
      onProgress: (cur, tot) => process.stdout.write(`\rBrasilAPI [${cur}/${tot}]`),
    })
    console.log('')
    const okCt = [...geoByCnpj.values()].filter((r) => r.ok).length
    console.log(`BrasilAPI OK (JSON): ${okCt}/${uniq.length} CNPJ(s)`)
  }

  if (somenteCnpjAtivos) {
    const excluded = new Set()
    for (const c of uniq) {
      const r = geoByCnpj.get(c)
      if (!r) {
        excluded.add(c)
        console.warn(`CNPJ excluído (sem consulta BrasilAPI — verifique flags): ${c}`)
        continue
      }
      if (!r.ok) {
        excluded.add(c)
        console.warn(`CNPJ excluído (BrasilAPI: ${r.reason ?? '?'}): ${c}`)
        continue
      }
      if (!r.cadastro_ativo) {
        excluded.add(c)
        console.warn(
          `CNPJ excluído (situação não ATIVA: ${r.descricao_situacao_cadastral ?? '—'}): ${c}`
        )
      }
    }
    const beforeG = groupList.length
    groupList = groupList.filter((g) => !excluded.has(g.cnpj14))
    if (excluded.size) {
      console.log(
        `Filtro situação ATIVA: ${groupList.length} grupo(s) restante(s) (removidos ${beforeG - groupList.length} grupo(s); ${excluded.size} CNPJ(s) bloqueado(s)).`
      )
    }
    if (!groupList.length) {
      console.error(
        'Nenhum grupo restante após exigir CNPJ ATIVO na Receita. Use --permitir-cnpj-inativo para incluir baixados/outros.'
      )
      process.exit(1)
    }
    ;({ sumItems, range } = recomputeItemRange(groupList))
    uniq = [...new Set(groupList.map((g) => g.cnpj14))]
  }

  const periodo_inicio = piCli || range?.min
  const periodo_fim = pfCli || range?.max

  if (!periodo_inicio || !periodo_fim) {
    console.error('Impossível determinar período; use --periodo-inicio e --periodo-fim.')
    process.exit(1)
  }

  console.log(`
Folha: ${sheetName}
Linhas dados (exc. cabeçalho): ${totalRows}
Grupos CNPJ×NF (após filtros): ${groupList.length}  |  Linhas NF descartadas (CNPJ inválido): ${skippedCnpj}
Linhas-itens graváveis (soma nos grupos): ${sumItems}
Período: ${periodo_inicio} … ${periodo_fim}
Política Receita: ${somenteCnpjAtivos ? 'apenas CNPJ com situação ATIVA' : '--permitir-cnpj-inativo (todas as situações)'}
`)

  if (dryRun) {
    console.log('\nDry-run OK — não gravou no Supabase.')
    process.exit(0)
  }

  const sb = createClient(SUPABASE_URL.replace(/\/$/, ''), SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const baseName = path.basename(file)
  const { data: up, error: eUp } = await sb
    .from('alwayson_insights_uploads')
    .insert({
      nome,
      periodo_inicio,
      periodo_fim,
      arquivo_nome: baseName,
      status: 'processando',
      total_nfs: null,
      total_itens: null,
      erros: null,
    })
    .select('id')
    .single()

  if (eUp || !up?.id) {
    console.error('Falha ao criar upload:', eUp?.message ?? eUp)
    process.exit(1)
  }
  const uploadId = up.id
  console.log('Upload criado:', uploadId)

  /** @type {Map<string, (typeof groupList)[0]['header']>} */
  const headerByCnpj = new Map()
  for (const g of groupList) {
    if (!headerByCnpj.has(g.cnpj14)) headerByCnpj.set(g.cnpj14, g.header)
  }

  const { data: existRows, error: eCliRead } = await sb
    .from('alwayson_insights_clientes')
    .select('*')
    .in('cnpj_14', uniq)
  if (eCliRead) {
    console.error('Falha ao ler alwayson_insights_clientes:', eCliRead.message)
    process.exit(1)
  }
  const prevBy = new Map((existRows ?? []).map((row) => [row.cnpj_14, row]))

  const clienteUpserts = uniq.map((cnpj14) => {
    const header = headerByCnpj.get(cnpj14) ?? {}
    const prev = prevBy.get(cnpj14)
    const geoR = geoByCnpj.get(cnpj14)
    return buildInsightsClienteRow(cnpj14, header, prev, geoR, geoImport)
  })

  const { error: eCliUp } = await sb.from('alwayson_insights_clientes').upsert(clienteUpserts, {
    onConflict: 'cnpj_14',
  })
  if (eCliUp) {
    console.error('Falha ao upsert alwayson_insights_clientes:', eCliUp.message)
    process.exit(1)
  }
  console.log(`Dimensão cliente: ${clienteUpserts.length} CNPJ(s) prontos (FK antes das NFs).`)

  let nfsOk = 0
  let itensOk = 0

  try {
    for (const batch of chunks(groupList, batchNfs)) {
      const nfPayloads = batch.map((g) => {
        const nfTotal = g.items.reduce((s, it) => s + (Number(it.valor_total) || 0), 0)
        return {
          upload_id: uploadId,
          numero_nf: g.numero_nf,
          data_emissao: g.dataIso,
          cnpj_cliente: g.cnpj14,
          razao_social: g.header.razao,
          nome_cliente: g.header.nome_cliente,
          codigo_vendedor: g.header.codigo_vendedor,
          nome_vendedor: g.header.nome_vendedor,
          codigo_supervisor: g.header.codigo_supervisor,
          nome_supervisor: g.header.nome_supervisor,
          codigo_gerente: g.header.codigo_gerente,
          nome_gerente: g.header.nome_gerente,
          valor_total: nfTotal,
          cod_emp: g.header.cod_emp,
          nome_emp: g.header.nome_emp,
        }
      })

      const { data: inserted, error: eN } = await sb
        .from('alwayson_insights_nf')
        .insert(nfPayloads)
        .select('id, numero_nf, cnpj_cliente')

      if (eN || !inserted?.length) {
        throw new Error(`NF batch: ${eN?.message ?? 'insert vazio'}`)
      }
      nfsOk += inserted.length

      /** @type {Map<string,string>} */
      const idByKey = new Map()
      for (const row of inserted) {
        idByKey.set(`${row.cnpj_cliente}|${row.numero_nf}`, row.id)
      }

      const itemPayloads = []
      for (const g of batch) {
        const nf_id = idByKey.get(`${g.cnpj14}|${g.numero_nf}`)
        if (!nf_id) throw new Error('ID NF não encontrado para ' + `${g.cnpj14}|${g.numero_nf}`)
        for (const it of g.items) {
          itemPayloads.push({
            nf_id,
            sku: it.sku,
            descricao: it.descricao,
            quantidade: it.quantidade,
            unidade: it.unidade,
            valor_unitario: it.valor_unitario,
            valor_total: it.valor_total,
            codprod_fornecedor: it.codprod_fornecedor,
            perfil: it.perfil,
          })
        }
      }

      const itemBatches = chunks(itemPayloads, 500)
      for (const ib of itemBatches) {
        const { error: eI } = await sb.from('alwayson_insights_nf_itens').insert(ib)
        if (eI) throw new Error(`Itens batch: ${eI.message}`)
        itensOk += ib.length
      }
    }

    const { error: eFinal } = await sb
      .from('alwayson_insights_uploads')
      .update({
        status: 'concluido',
        total_nfs: nfsOk,
        total_itens: itensOk,
      })
      .eq('id', uploadId)

    if (eFinal) throw new Error(`Atualização upload final: ${eFinal.message}`)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await sb
      .from('alwayson_insights_uploads')
      .update({
        status: 'erro',
        erros: [{ etapa: 'import script', mensagem: msg }],
      })
      .eq('id', uploadId)
    console.error('Erro durante import:', msg)
    process.exit(1)
  }

  console.log(`
Concluído.
  NFs inseridas: ${nfsOk}
  Itens inseridos: ${itensOk}
  Upload: ${uploadId}
`)
}

await main()
