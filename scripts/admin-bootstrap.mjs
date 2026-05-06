#!/usr/bin/env node
/**
 * Bootstrap do admin global.
 *
 * O que faz:
 *  1. Garante o utilizador no auth.users (cria com password se não existir; opcionalmente força reset).
 *  2. Garante o registro em alwayson_user_profiles (status='active').
 *  3. Garante o membership 'admin' no tenant 'admin_global' (slug 'arruda').
 *
 * Uso:
 *   node scripts/admin-bootstrap.mjs --email maurofilho@grupoarruda.com --password 'Senha-Inicial-Forte!'
 *   node scripts/admin-bootstrap.mjs --email outro@dominio.com --tenant arruda --role admin
 *   node scripts/admin-bootstrap.mjs --email maurofilho@grupoarruda.com --invite   # envia magic link em vez de password
 *
 * Pré-requisitos: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local (projeto canônico).
 */

/* eslint-disable no-console -- CLI */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

tryLoadDotenv()

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

function parseArgs(argv) {
  const out = {
    email: '',
    password: '',
    tenant: 'arruda',
    role: 'admin',
    invite: false,
    nome: '',
  }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--email') out.email = argv[++i] ?? ''
    else if (a === '--password') out.password = argv[++i] ?? ''
    else if (a === '--tenant') out.tenant = argv[++i] ?? 'arruda'
    else if (a === '--role') out.role = argv[++i] ?? 'admin'
    else if (a === '--invite') out.invite = true
    else if (a === '--nome') out.nome = argv[++i] ?? ''
    else if (a === '--help' || a === '-h') {
      console.log(
        'Uso: --email <e> [--password <p> | --invite] [--tenant <slug>=arruda] [--role <r>=admin] [--nome <n>]'
      )
      process.exit(0)
    }
  }
  return out
}

async function getOrCreateUser(sb, email, { password, invite, nome }) {
  // Procura na auth.users via admin API (paginação simples)
  let user = null
  let page = 1
  // 50 páginas de 200 = 10k usuários (mais que suficiente p/ esta plataforma)
  while (page <= 50) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw new Error(`listUsers falhou: ${error.message}`)
    user = data?.users?.find((u) => (u.email || '').toLowerCase() === email.toLowerCase()) ?? null
    if (user) return { user, created: false, invitedNow: false }
    if (!data?.users?.length || data.users.length < 200) break
    page += 1
  }

  if (invite) {
    const { data, error } = await sb.auth.admin.inviteUserByEmail(email, {
      data: nome ? { nome } : undefined,
    })
    if (error) throw new Error(`inviteUserByEmail falhou: ${error.message}`)
    return { user: data.user, created: true, invitedNow: true }
  }

  if (!password) {
    throw new Error('Sem --password e sem --invite: nada para fazer (user não existe).')
  }

  const { data, error } = await sb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: nome ? { nome } : {},
  })
  if (error) throw new Error(`createUser falhou: ${error.message}`)
  return { user: data.user, created: true, invitedNow: false }
}

async function main() {
  const opts = parseArgs(process.argv)
  if (!opts.email) {
    console.error('--email é obrigatório.')
    process.exit(1)
  }

  const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!SUPABASE_URL || !SERVICE) {
    console.error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local')
    process.exit(1)
  }

  const sb = createClient(SUPABASE_URL.replace(/\/$/, ''), SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  console.log(`Garantindo utilizador: ${opts.email}`)
  const { user, created, invitedNow } = await getOrCreateUser(sb, opts.email, opts)
  if (!user?.id) {
    throw new Error('Não consegui obter user.id')
  }
  console.log(
    created
      ? invitedNow
        ? `Convidado (magic link enviado): ${user.id}`
        : `Criado com password: ${user.id}`
      : `Já existia: ${user.id}`
  )

  await sb
    .from('alwayson_user_profiles')
    .upsert(
      {
        user_id: user.id,
        email: opts.email,
        nome: opts.nome || user.user_metadata?.nome || opts.email,
        status: 'active',
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )
    .throwOnError()

  const { data: tenant, error: eTenant } = await sb
    .from('alwayson_tenants')
    .select('id, tipo, nome, slug')
    .eq('slug', opts.tenant)
    .maybeSingle()

  if (eTenant) throw new Error(`Tenant lookup: ${eTenant.message}`)
  if (!tenant) throw new Error(`Tenant slug='${opts.tenant}' não encontrado.`)

  await sb
    .from('alwayson_memberships')
    .upsert(
      {
        user_id: user.id,
        tenant_id: tenant.id,
        role: opts.role,
        ativo: true,
        aceito_em: new Date().toISOString(),
      },
      { onConflict: 'user_id,tenant_id,role' }
    )
    .throwOnError()

  console.log(`Membership: ${opts.role} @ tenant '${tenant.slug}' (${tenant.tipo})`)
  console.log('Bootstrap concluído.')
}

await main().catch((err) => {
  console.error('Falhou:', err.message)
  process.exit(1)
})
