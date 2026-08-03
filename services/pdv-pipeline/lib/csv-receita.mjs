import * as fs from 'node:fs'
import * as path from 'node:path'
import * as readline from 'node:readline'

/**
 * Lê CSV da Receita (delimitador ;, encoding latin1) linha a linha.
 * @param {string} filePath
 * @param {(cols: string[]) => void | Promise<void>} onRow
 */
export async function streamReceitaCsv(filePath, onRow) {
  const stream = fs.createReadStream(filePath, { encoding: 'latin1' })
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity })
  for await (const line of rl) {
    if (!line.trim()) continue
    const cols = parseReceitaLine(line)
    await onRow(cols)
  }
}

/** Split respeitando campos entre aspas (formato RF). */
function parseReceitaLine(line) {
  const out = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuotes = !inQuotes
      continue
    }
    if (ch === ';' && !inQuotes) {
      out.push(cur)
      cur = ''
      continue
    }
    cur += ch
  }
  out.push(cur)
  return out.map((s) => s.trim())
}

const RECEITA_KIND_MATCH = {
  estabele: (name) => /^estabele/i.test(name) || /\.estabele$/i.test(name),
  empresas: (name) => /^empresas/i.test(name) || /\.empresa/i.test(name),
  simples: (name) => /^simples/i.test(name),
}

export function listReceitaCsvFiles(dataDir, kind) {
  if (!fs.existsSync(dataDir)) return []
  const match = RECEITA_KIND_MATCH[kind]
  if (!match) throw new Error(`Tipo Receita desconhecido: ${kind}`)
  return fs
    .readdirSync(dataDir)
    .filter((f) => {
      const upper = f.toUpperCase()
      if (upper.endsWith('.ZIP')) return false
      return match(f)
    })
    .sort()
    .map((f) => path.join(dataDir, f))
}
