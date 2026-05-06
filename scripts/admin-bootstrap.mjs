#!/usr/bin/env node
/**
 * Bootstrap de utilizadores e geração de magic links / recovery / convites.
 *
 * O que faz:
 *  1. Garante o utilizador no auth.users (cria com password / convida / só atualiza).
 *  2. Garante o registro em alwayson_user_profiles (status='active').
 *  3. Garante o membership no tenant indicado (default: 'arruda', role 'admin').
 *  4. Opcionalmente gera um link de acesso (magic link, invite, recovery) e
 *     imprime no terminal — útil quando o e-mail demora ou cai em spam.
 *
 * Uso:
 *   # Cria/garante user + membership; senha definida (UX admin):
 *   node scripts/admin-bootstrap.mjs --email maurofilho@grupoarruda.com --password 'Senha-Inicial-Forte!'
 *
 *   # Convida por e-mail (Supabase envia o link), respeitando o redirect:
 *   node scripts/admin-bootstrap.mjs --email novo@empresa.com --invite \
 *        --redirect-to http://localhost:5173/redefinir-password
 *
 *   # Não envia e-mail; gera magic link e IMPRIME no terminal:
 *   node scripts/admin-bootstrap.mjs --email maurofilho@grupoarruda.com --magiclink \
 *        --redirect-to http://localhost:5173
 *
 *   # Gera link de recovery (reset de senha) e imprime no terminal:
 *   node scripts/admin-bootstrap.mjs --email maurofilho@grupoarruda.com --reset \
 *        --redirect-to http://localhost:5173/redefinir-password
 *
 *   # Tenant/role customizados:
 *   node scripts/admin-bootstrap.mjs --email outro@dominio.com --tenant arruda --role admin --magiclink
 *
 * Env vars (.env.local):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (obrigatórios)
 *   APP_URL                                  (opcional; default p/ --redirect-to)
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
    magiclink: false,
    reset: false,
    printLink: false,
    redirectTo: '',
    nome: '',
  }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--email') out.email = argv[++i] ?? ''
    else if (a === '--password') out.password = argv[++i] ?? ''
    else if (a === '--tenant') out.tenant = argv[++i] ?? 'arruda'
    else if (a === '--role') out.role = argv[++i] ?? 'admin'
    else if (a === '--invite') out.invite = true
    else if (a === '--magiclink') out.magiclink = true
    else if (a === '--reset') out.reset = true
    else if (a === '--print-link') out.printLink = true
    else if (a === '--redirect-to') out.redirectTo = argv[++i] ?? ''
    else if (a === '--nome') out.nome = argv[++i] ?? ''
    else if (a === '--help' || a === '-h') {
      console.log(
        [
          'Uso:',
          '  --email <e>                obrigatório',
          '  --password <p>             cria com senha (UX admin)',
          '  --invite                   convida por e-mail',
          '  --magiclink                gera magic link e imprime (não envia e-mail)',
          '  --reset                    envia link de recovery e (com --print-link) imprime',
          '  --print-link               também imprime o link gerado',
          '  --redirect-to <url>        URL de retorno (precisa estar na allowlist Auth)',
          '  --tenant <slug>=arruda     slug do tenant em alwayson_tenants',
          '  --role <r>=admin           role no membership',
          '  --nome <n>                 nome do utilizador',
          '',
          'Env: APP_URL é usado como default de --redirect-to.',
        ].join('\n')
      )
      process.exit(0)
    }
  }
  if (!out.redirectTo) out.redirectTo = process.env.APP_URL || 'http://localhost:5173'
  return out
}

async function findUser(sb, email) {
  let page = 1
  while (page <= 50) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw new Error(`listUsers falhou: ${error.message}`)
    const u = data?.users?.find((u) => (u.email || '').toLowerCase() === email.toLowerCase()) ?? null
    if (u) return u
    if (!data?.users?.length || data.users.length < 200) break
    page += 1
  }
  return null
}

async function ensureUser(sb, opts) {
  const existing = await findUser(sb, opts.email)
  if (existing) return { user: existing, created: false, invitedNow: false }

  if (opts.invite) {
    const { data, error } = await sb.auth.admin.inviteUserByEmail(opts.email, {
      data: opts.nome ? { nome: opts.nome } : undefined,
      redirectTo: opts.redirectTo,
    })
    if (error) throw new Error(`inviteUserByEmail falhou: ${error.message}`)
    return { user: data.user, created: true, invitedNow: true }
  }

  if (opts.magiclink) {
    const tempPass = `tmp_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`
    const { data, error } = await sb.auth.admin.createUser({
      email: opts.email,
      password: tempPass,
      email_confirm: true,
      user_metadata: opts.nome ? { nome: opts.nome } : {},
    })
    if (error) throw new Error(`createUser (para magiclink) falhou: ${error.message}`)
    return { user: data.user, created: true, invitedNow: false }
  }

  if (opts.password) {
    const { data, error } = await sb.auth.admin.createUser({
      email: opts.email,
      password: opts.password,
      email_confirm: true,
      user_metadata: opts.nome ? { nome: opts.nome } : {},
    })
    if (error) throw new Error(`createUser falhou: ${error.message}`)
    return { user: data.user, created: true, invitedNow: false }
  }

  throw new Error('Sem --password, --invite, --magiclink ou --reset: nada para fazer.')
}

async function generateActionLink(sb, opts) {
  const type = opts.magiclink ? 'magiclink' : opts.reset ? 'recovery' : opts.invite ? 'invite' : null
  if (!type) return null
  const { data, error } = await sb.auth.admin.generateLink({
    type,
    email: opts.email,
    options: { redirectTo: opts.redirectTo },
  })
  if (error) throw new Error(`generateLink (${type}) falhou: ${error.message}`)
  return data?.properties?.action_link || null
}

async function maybeSendRecoveryEmail(sb, opts) {
  if (!opts.reset) return false
  const { error } = await sb.auth.resetPasswordForEmail(opts.email, {
    redirectTo: opts.redirectTo,
  })
  if (error) throw new Error(`resetPasswordForEmail falhou: ${error.message}`)
  return true
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

  console.log(`→ Garantindo utilizador: ${opts.email}`)
  console.log(`  redirect-to: ${opts.redirectTo}`)

  const { user, created, invitedNow } = await ensureUser(sb, opts)
  if (!user?.id) throw new Error('Não consegui obter user.id')

  console.log(
    created
      ? invitedNow
        ? `  ✓ Convidado (e-mail enviado): ${user.id}`
        : `  ✓ Criado: ${user.id}`
      : `  ✓ Já existia: ${user.id}`
  )

  // Profile
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

  // Tenant + membership
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

  console.log(`  ✓ Membership: ${opts.role} @ tenant '${tenant.slug}' (${tenant.tipo})`)

  // Recovery por e-mail (independente da geração do link)
  const sentRecovery = await maybeSendRecoveryEmail(sb, opts)
  if (sentRecovery) console.log('  ✓ Recovery e-mail enviado.')

  // Geração de link (magiclink/invite/recovery)
  const wantsLink = opts.magiclink || (opts.printLink && (opts.invite || opts.reset))
  if (wantsLink) {
    const link = await generateActionLink(sb, opts)
    if (link) {
      console.log('')
      console.log('────────────────────────────────────────────────────────────')
      console.log(' Link de acesso (single-use; expira ~1h):')
      console.log(' ' + link)
      console.log('────────────────────────────────────────────────────────────')
      console.log('')
    } else {
      console.log('  (sem link — nenhum tipo elegível)')
    }
  }

  console.log('Bootstrap concluído.')
}

await main().catch((err) => {
  console.error('Falhou:', err.message)
  process.exit(1)
})
