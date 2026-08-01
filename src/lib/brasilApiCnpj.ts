/**
 * Consulta CNPJ via BrasilAPI (Receita Federal) — mesmo fluxo dos Insights.
 * Público; CORS liberado. Preferir v1, fallback v2.
 */

export type BrasilApiCnpjResult =
  | {
      ok: true
      cnpj14: string
      razaoSocial: string
      nomeFantasia: string | null
      cidade: string
      uf: string
      email: string | null
      telefone: string | null
      responsavel: string | null
      situacao: string | null
      cadastroAtivo: boolean
    }
  | { ok: false; reason: string }

function digits14(raw: string): string {
  const d = String(raw ?? '').replace(/\D/g, '')
  if (d.length > 14) return d.slice(-14)
  return d.length && d.length < 14 ? d.padStart(14, '0') : d
}

function pickStr(...vals: unknown[]): string {
  for (const v of vals) {
    if (v == null) continue
    const s = String(v).trim()
    if (s) return s
  }
  return ''
}

function municipioNome(mun: unknown): string {
  if (mun == null) return ''
  if (typeof mun === 'string') return mun.trim()
  if (typeof mun === 'object' && mun !== null && 'descricao' in mun) {
    return pickStr((mun as { descricao?: unknown }).descricao)
  }
  return ''
}

function formatTelefone(ddd: unknown, tel: unknown): string | null {
  const d = pickStr(ddd).replace(/\D/g, '')
  const t = pickStr(tel).replace(/\D/g, '')
  if (!t) return null
  if (d && t.length >= 8) {
    const local = t.length === 9 ? `${t.slice(0, 5)}-${t.slice(5)}` : `${t.slice(0, 4)}-${t.slice(4)}`
    return `(${d}) ${local}`
  }
  if (t.length === 10 || t.length === 11) {
    const dd = t.slice(0, 2)
    const rest = t.slice(2)
    const local =
      rest.length === 9
        ? `${rest.slice(0, 5)}-${rest.slice(5)}`
        : `${rest.slice(0, 4)}-${rest.slice(4)}`
    return `(${dd}) ${local}`
  }
  return t
}

function firstSocioNome(data: Record<string, unknown>): string | null {
  const qsa = data.qsa
  if (!Array.isArray(qsa) || qsa.length === 0) return null
  const first = qsa[0]
  if (!first || typeof first !== 'object') return null
  const row = first as Record<string, unknown>
  return pickStr(row.nome_socio, row.nomeSocio, row.nome) || null
}

function cadastroAtivo(data: Record<string, unknown>): boolean {
  const desc = pickStr(data.descricao_situacao_cadastral, data.descricaoSituacaoCadastral).toUpperCase()
  if (desc === 'ATIVA') return true
  const code = data.situacao_cadastral ?? data.situacaoCadastral
  return code === 2 || code === '2'
}

async function fetchVer(
  ver: 'v1' | 'v2',
  cnpj14: string
): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; reason: string }> {
  const url = `https://brasilapi.com.br/api/cnpj/${ver}/${cnpj14}`
  let res: Response
  try {
    res = await fetch(url, { headers: { Accept: 'application/json' } })
  } catch {
    return { ok: false, reason: 'falha_rede' }
  }

  let json: Record<string, unknown> | null = null
  try {
    json = (await res.json()) as Record<string, unknown>
  } catch {
    json = null
  }

  if (res.ok && json) return { ok: true, data: json }
  if (res.status === 404) return { ok: false, reason: 'nao_encontrado' }
  if (res.status === 400) return { ok: false, reason: 'cnpj_invalido' }
  if (res.status === 429) return { ok: false, reason: 'rate_limit' }
  return { ok: false, reason: `http_${res.status}` }
}

export async function lookupBrasilApiCnpj(raw: string): Promise<BrasilApiCnpjResult> {
  const cnpj14 = digits14(raw)
  if (cnpj14.length !== 14) {
    return { ok: false, reason: 'cnpj_incompleto' }
  }

  let fetched = await fetchVer('v1', cnpj14)
  if (!fetched.ok) {
    if (fetched.reason === 'nao_encontrado' || fetched.reason === 'cnpj_invalido') {
      return { ok: false, reason: fetched.reason }
    }
    const v2 = await fetchVer('v2', cnpj14)
    if (!v2.ok) return { ok: false, reason: v2.reason }
    fetched = v2
  }

  const d = fetched.data
  const nested =
    typeof d.endereco === 'object' && d.endereco !== null
      ? (d.endereco as Record<string, unknown>)
      : null

  const razaoSocial = pickStr(d.razao_social, d.razaoSocial, d.nome)
  const nomeFantasia = pickStr(d.nome_fantasia, d.nomeFantasia) || null
  const cidade =
    pickStr(d.municipio) ||
    municipioNome(nested?.municipio) ||
    municipioNome(nested?.municipioJurisdicao)
  const uf = pickStr(d.uf, nested?.uf).toUpperCase().slice(0, 2)
  const email = pickStr(d.email, nested?.email) || null
  const telefone =
    formatTelefone(d.ddd_telefone_1, d.telefone_1) ||
    formatTelefone(null, d.ddd_telefone_1) ||
    formatTelefone(nested?.ddd, nested?.telefone) ||
    null
  const situacao =
    pickStr(d.descricao_situacao_cadastral, d.descricaoSituacaoCadastral) || null

  if (!razaoSocial) {
    return { ok: false, reason: 'sem_razao_social' }
  }

  return {
    ok: true,
    cnpj14,
    razaoSocial,
    nomeFantasia,
    cidade,
    uf,
    email,
    telefone,
    responsavel: firstSocioNome(d),
    situacao,
    cadastroAtivo: cadastroAtivo(d),
  }
}

export function humanizeBrasilApiCnpjError(reason: string): string {
  switch (reason) {
    case 'cnpj_incompleto':
      return 'Informe os 14 dígitos do CNPJ.'
    case 'nao_encontrado':
      return 'CNPJ não encontrado na Receita Federal.'
    case 'cnpj_invalido':
      return 'CNPJ inválido.'
    case 'rate_limit':
      return 'Muitas consultas. Aguarde alguns segundos e tente de novo.'
    case 'falha_rede':
      return 'Não foi possível consultar a BrasilAPI. Verifique a rede.'
    case 'sem_razao_social':
      return 'A Receita não retornou a razão social deste CNPJ.'
    default:
      return `Falha na consulta (${reason}).`
  }
}
