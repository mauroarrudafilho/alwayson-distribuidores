import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.99.1'
import {
  corpoConviteHtml,
  corpoConviteTexto,
  type InviteEmailAcesso,
} from '../_shared/invite-email-template.ts'

type MembershipRole =
  | 'admin'
  | 'gestor'
  | 'gestor_cliente'
  | 'gestor_fornecedor'
  // KAM: fornecedor ∈ seus E distribuidor ∈ seus (migrations 047/048).
  | 'kam'
  | 'vendedor'
  | 'supervisor'
  | 'gerente'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

const RESEND_ENDPOINT = 'https://api.resend.com/emails'

/**
 * Entrega o convite pelo Resend. Opt-in: sem `RESEND_API_KEY` a função mantém o
 * caminho antigo (e-mail nativo do Supabase), então publicar isto não altera
 * comportamento enquanto o segredo não estiver definido.
 */
async function enviarPorResend(
  email: string,
  actionLink: string,
  nome?: string,
  acesso?: InviteEmailAcesso,
): Promise<{ ok: boolean; message?: string }> {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey) return { ok: false, message: 'RESEND_API_KEY não definida' }
  const from = Deno.env.get('RESEND_FROM') ?? 'Always On <onboarding@resend.dev>'

  const content = { actionLink, nome, acesso }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [email],
        subject: 'Seu acesso à plataforma Always On',
        html: corpoConviteHtml(content),
        text: corpoConviteTexto(content),
      }),
    })
    if (!res.ok) {
      const corpo = await res.text().catch(() => '')
      return { ok: false, message: `Resend ${res.status}: ${corpo.slice(0, 300)}` }
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) }
  }
}

function randomToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://alwayson-distribuidores.vercel.app',
]

function canonicalAppOrigin(): string {
  return (Deno.env.get('APP_PUBLIC_URL') ?? '').trim().replace(/\/$/, '')
}

function parseAllowedOrigins(): string[] {
  const extra = (Deno.env.get('ALLOWED_APP_ORIGINS') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const merged = [...DEFAULT_ALLOWED_ORIGINS, ...extra]
  const canonical = canonicalAppOrigin()
  if (canonical) merged.push(canonical)
  return [...new Set(merged)]
}

/** Convites a parceiros devem apontar para produção, não localhost do admin. */
function resolveInviteAppOrigin(requestedOrigin: string):
  | { ok: true; origin: string }
  | { ok: false; error: string; message: string } {
  const allowed = parseAllowedOrigins()
  const canonical = canonicalAppOrigin()
  const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(requestedOrigin)

  if (isLocal && canonical && allowed.includes(canonical)) {
    return { ok: true, origin: canonical }
  }

  if (requestedOrigin && allowed.includes(requestedOrigin)) {
    return { ok: true, origin: requestedOrigin }
  }

  if (canonical && allowed.includes(canonical)) {
    return { ok: true, origin: canonical }
  }

  return {
    ok: false,
    error: 'origin_nao_autorizada',
    message:
      'app_origin deve ser a origem exata da aplicação e estar na lista permitida na função.',
  }
}

function isRole(v: unknown): v is MembershipRole {
  const roles: MembershipRole[] = [
    'admin',
    'gestor',
    'gestor_cliente',
    'gestor_fornecedor',
    'kam',
    'vendedor',
    'supervisor',
    'gerente',
  ]
  return typeof v === 'string' && roles.includes(v as MembershipRole)
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map((s) => s.trim())
}

type MembershipSpec = { tenant_id: string; role: MembershipRole }

function rolePrecisaFornecedor(role: MembershipRole): boolean {
  return role === 'gestor_fornecedor' || role === 'kam'
}

function rolePrecisaDistribuidor(role: MembershipRole): boolean {
  return role !== 'admin' && role !== 'gestor_fornecedor'
}

function buildMemberships(
  role: MembershipRole,
  fornecedorIds: string[],
  distribuidorIds: string[],
  adminTenantId: string | null,
): MembershipSpec[] {
  if (role === 'admin') {
    return adminTenantId ? [{ tenant_id: adminTenantId, role: 'admin' }] : []
  }
  const specs: MembershipSpec[] = []
  if (rolePrecisaFornecedor(role)) {
    for (const tenant_id of fornecedorIds) specs.push({ tenant_id, role })
  }
  if (rolePrecisaDistribuidor(role)) {
    for (const tenant_id of distribuidorIds) specs.push({ tenant_id, role })
  }
  return specs
}

async function buildAcessoConvite(
  adminSb: SupabaseClient,
  fornecedorIds: string[],
  distribuidorIds: string[],
): Promise<InviteEmailAcesso | undefined> {
  const acesso: InviteEmailAcesso = { fornecedores: [], parceiros: [] }

  if (fornecedorIds.length) {
    const { data } = await adminSb.from('alwayson_tenants').select('nome').in('id', fornecedorIds)
    acesso.fornecedores = (data ?? []).map((t) => t.nome as string).filter(Boolean)
  }
  if (distribuidorIds.length) {
    const { data } = await adminSb.from('alwayson_tenants').select('nome').in('id', distribuidorIds)
    acesso.parceiros = (data ?? []).map((t) => t.nome as string).filter(Boolean)
  }

  if (!acesso.fornecedores.length && !acesso.parceiros.length) return undefined
  return acesso
}

async function deleteInvite(adminSb: SupabaseClient, id: string) {
  await adminSb.from('alwayson_user_invites').delete().eq('id', id)
}

function looksRegisteredError(msg: string) {
  const m = msg.toLowerCase()
  return (
    m.includes('already') ||
    m.includes('registered') ||
    m.includes('exists') ||
    m.includes('user already')
  )
}

type DeliveryResult = {
  ok: boolean
  delivery?: 'resend' | 'signup_email' | 'magiclink' | 'manual'
  action_link?: string
  message?: string
  error?: string
}

function buildInviteRedirect(appOrigin: string, token: string): string {
  const next = encodeURIComponent(`/aceitar-convite/${token}`)
  return `${appOrigin}/redefinir-password?next=${next}&flow=invite`
}

async function entregarConviteEmail(
  adminSb: SupabaseClient,
  email: string,
  redirectTo: string,
  nome: string | undefined,
  acesso: InviteEmailAcesso | undefined,
  opts?: { reenvio?: boolean },
): Promise<DeliveryResult> {
  const reenvio = opts?.reenvio ?? false
  if (Deno.env.get('RESEND_API_KEY')) {
    let actionLink: string | null = null

    const convite = await adminSb.auth.admin.generateLink({
      type: 'invite',
      email,
      options: {
        redirectTo,
        data: { ...(nome ? { nome } : {}), needs_password_setup: true },
      },
    })

    if (convite.data?.properties?.action_link) {
      actionLink = convite.data.properties.action_link
    } else if (looksRegisteredError(convite.error?.message ?? '')) {
      const ml = await adminSb.auth.admin.generateLink({
        type: 'magiclink',
        email,
        options: { redirectTo },
      })
      actionLink = ml.data?.properties?.action_link ?? null
    }

    if (!actionLink) {
      return {
        ok: false,
        error: 'link_falhou',
        message: convite.error?.message ?? 'Sem action_link',
      }
    }

    const envio = await enviarPorResend(email, actionLink, nome, acesso)
    if (envio.ok) {
      return {
        ok: true,
        delivery: 'resend',
        message: reenvio
          ? 'Convite reenviado por e-mail (Resend).'
          : 'Convite enviado por e-mail (Resend).',
      }
    }

    return {
      ok: true,
      delivery: 'manual',
      action_link: actionLink,
      message: `Não foi possível enviar pelo Resend (${envio.message}). Copie o link e envie manualmente.`,
    }
  }

  const { error: inviteEmailErr } = await adminSb.auth.admin.inviteUserByEmail(email, {
    data: { ...(nome ? { nome } : {}), needs_password_setup: true },
    redirectTo,
  })

  if (!inviteEmailErr) {
    return {
      ok: true,
      delivery: 'signup_email',
      message: 'Convite enviado por e-mail (Supabase Auth).',
    }
  }

  const em = inviteEmailErr.message ?? ''
  if (!looksRegisteredError(em)) {
    return { ok: false, error: 'email_envio_falhou', message: em }
  }

  const { data: linkData, error: linkErr } = await adminSb.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo },
  })

  if (linkErr || !linkData?.properties?.action_link) {
    return {
      ok: false,
      error: 'magiclink_falhou',
      message: linkErr?.message ?? 'Sem action_link',
    }
  }

  return {
    ok: true,
    delivery: 'magiclink',
    action_link: linkData.properties.action_link,
    message:
      'Este e-mail já tem conta. Copie o link mágico e envie manualmente — abre login e redireciona para aceitar o convite.',
  }
}

function escopoTenantIds(escopo: unknown): { fornecedorIds: string[]; distribuidorIds: string[] } {
  if (!escopo || typeof escopo !== 'object') {
    return { fornecedorIds: [], distribuidorIds: [] }
  }
  const e = escopo as Record<string, unknown>
  return {
    fornecedorIds: asStringArray(e.fornecedor_tenant_ids),
    distribuidorIds: asStringArray(e.distribuidor_tenant_ids),
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

  if (!supabaseUrl || !anonKey || !serviceKey) {
    return jsonResponse({ ok: false, error: 'server_misconfigured' }, 500)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonResponse({ ok: false, error: 'missing_auth' }, 401)
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const { data: adminFlag, error: adminErr } = await userClient.rpc('current_user_is_admin')
  if (adminErr) {
    console.error('current_user_is_admin:', adminErr.message)
    return jsonResponse({ ok: false, error: 'admin_check_failed' }, 500)
  }
  if (!adminFlag) {
    return jsonResponse({ ok: false, error: 'forbidden' }, 403)
  }

  const {
    data: { user: inviter },
  } = await userClient.auth.getUser()
  if (!inviter?.id) {
    return jsonResponse({ ok: false, error: 'no_user_context' }, 401)
  }

  let body: Record<string, unknown> = {}
  try {
    const t = await req.text()
    if (t.trim()) body = JSON.parse(t) as Record<string, unknown>
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_json' }, 400)
  }

  const action = typeof body.action === 'string' ? body.action.trim() : 'create'
  const requestedOrigin =
    typeof body.app_origin === 'string' ? body.app_origin.trim().replace(/\/$/, '') : ''

  const originResolved = resolveInviteAppOrigin(requestedOrigin)
  if (!originResolved.ok) {
    return jsonResponse(
      { ok: false, error: originResolved.error, message: originResolved.message },
      403,
    )
  }
  const app_origin = originResolved.origin

  const adminSb = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  if (action === 'resend') {
    const invite_id = typeof body.invite_id === 'string' ? body.invite_id.trim() : ''
    if (!invite_id) {
      return jsonResponse({ ok: false, error: 'invite_id_obrigatorio' }, 400)
    }

    const { data: inv, error: invErr } = await adminSb
      .from('alwayson_user_invites')
      .select('id, email, role, status, escopo')
      .eq('id', invite_id)
      .maybeSingle()

    if (invErr) {
      console.error('resend lookup:', invErr.message)
      return jsonResponse({ ok: false, error: 'invite_lookup_failed' }, 500)
    }
    if (!inv) {
      return jsonResponse({ ok: false, error: 'convite_nao_encontrado' }, 404)
    }
    if (inv.status === 'accepted' || inv.status === 'revoked') {
      return jsonResponse(
        {
          ok: false,
          error: 'convite_nao_reenviavel',
          message: 'Só é possível reenviar convites pendentes ou expirados.',
        },
        409,
      )
    }

    const token = randomToken()
    const redirectTo = buildInviteRedirect(app_origin, token)
    const expira_em = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()

    const { error: updErr } = await adminSb
      .from('alwayson_user_invites')
      .update({
        token,
        status: 'pending',
        expira_em,
        convidado_por: inviter.id,
      })
      .eq('id', invite_id)

    if (updErr) {
      console.error('resend update:', updErr.message)
      return jsonResponse({ ok: false, error: 'invite_update_failed' }, 500)
    }

    const { fornecedorIds, distribuidorIds } = escopoTenantIds(inv.escopo)
    const acessoConvite = await buildAcessoConvite(adminSb, fornecedorIds, distribuidorIds)

    const { data: profile } = await adminSb
      .from('alwayson_user_profiles')
      .select('nome')
      .eq('email', inv.email)
      .maybeSingle()
    const nomeConvidado = typeof profile?.nome === 'string' ? profile.nome.trim() : ''

    const entrega = await entregarConviteEmail(
      adminSb,
      inv.email,
      redirectTo,
      nomeConvidado || undefined,
      acessoConvite,
      { reenvio: true },
    )

    if (!entrega.ok) {
      return jsonResponse(
        {
          ok: false,
          error: entrega.error ?? 'email_envio_falhou',
          message: entrega.message,
          invite_id,
        },
        502,
      )
    }

    return jsonResponse({
      ok: true,
      delivery: entrega.delivery,
      invite_id,
      action_link: entrega.action_link,
      message: entrega.message ?? 'Convite reenviado.',
    })
  }

  const emailRaw = typeof body.email === 'string' ? body.email.trim() : ''
  const email = emailRaw.toLowerCase()
  const tenant_id_legacy = typeof body.tenant_id === 'string' ? body.tenant_id.trim() : ''
  const fornecedor_tenant_ids = asStringArray(body.fornecedor_tenant_ids)
  const distribuidor_tenant_ids = asStringArray(body.distribuidor_tenant_ids)
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonResponse({ ok: false, error: 'email_invalido' }, 400)
  }
  if (!isRole(body.role)) {
    return jsonResponse({ ok: false, error: 'role_invalida' }, 400)
  }
  const role = body.role

  let adminGlobalTenantId: string | null = null
  if (role === 'admin') {
    const { data: adminTenant } = await adminSb
      .from('alwayson_tenants')
      .select('id')
      .eq('tipo', 'admin_global')
      .eq('ativo', true)
      .order('criado_em', { ascending: true })
      .limit(1)
      .maybeSingle()
    adminGlobalTenantId = adminTenant?.id ?? null
    if (!adminGlobalTenantId) {
      return jsonResponse({ ok: false, error: 'admin_tenant_ausente' }, 500)
    }
  }

  const memberships =
    fornecedor_tenant_ids.length > 0 || distribuidor_tenant_ids.length > 0 || role === 'admin'
      ? buildMemberships(role, fornecedor_tenant_ids, distribuidor_tenant_ids, adminGlobalTenantId)
      : tenant_id_legacy
        ? [{ tenant_id: tenant_id_legacy, role }]
        : []

  if (memberships.length === 0) {
    return jsonResponse(
      {
        ok: false,
        error: 'vinculos_obrigatorios',
        message: 'Informe fornecedor e/ou distribuidor conforme o papel escolhido.',
      },
      400,
    )
  }

  if (role === 'kam' && (fornecedor_tenant_ids.length === 0 || distribuidor_tenant_ids.length === 0)) {
    return jsonResponse(
      {
        ok: false,
        error: 'kam_precisa_dois_eixos',
        message: 'KAM exige fornecedor e distribuidor — o acesso é a interseção dos dois.',
      },
      400,
    )
  }

  const tenant_id = memberships[0].tenant_id
  const escopo = {
    memberships,
    fornecedor_tenant_ids,
    distribuidor_tenant_ids,
  }

  const { data: pend, error: pendErr } = await adminSb
    .from('alwayson_user_invites')
    .select('id')
    .eq('email', email)
    .eq('tenant_id', tenant_id)
    .eq('status', 'pending')
    .maybeSingle()

  if (pendErr) {
    console.error('pending lookup:', pendErr.message)
    return jsonResponse({ ok: false, error: 'invite_lookup_failed' }, 500)
  }
  if (pend?.id) {
    return jsonResponse({ ok: false, error: 'convite_pendente_ja_existe' }, 409)
  }

  const token = randomToken()
  const redirectTo = buildInviteRedirect(app_origin, token)

  const { data: inserted, error: insErr } = await adminSb
    .from('alwayson_user_invites')
    .insert({
      email,
      tenant_id,
      role,
      escopo,
      token,
      convidado_por: inviter.id,
      status: 'pending',
    })
    .select('id')
    .single()

  if (insErr || !inserted?.id) {
    console.error('insert invite:', insErr?.message)
    return jsonResponse({ ok: false, error: 'insert_invite_failed' }, 500)
  }

  const inviteRowId = inserted.id as string
  const acessoConvite = await buildAcessoConvite(
    adminSb,
    fornecedor_tenant_ids,
    distribuidor_tenant_ids,
  )

  const entrega = await entregarConviteEmail(
    adminSb,
    email,
    redirectTo,
    nome || undefined,
    acessoConvite,
  )

  if (!entrega.ok) {
    await deleteInvite(adminSb, inviteRowId)
    return jsonResponse(
      {
        ok: false,
        error: entrega.error ?? 'email_envio_falhou',
        message: entrega.message,
        invite_id: inviteRowId,
        hint: 'O registo do convite ficou pendente na base de dados. Revogue na UI se quiser cancelar, ou corrija a configuração de e-mail no Supabase.',
      },
      502,
    )
  }

  return jsonResponse({
    ok: true,
    delivery: entrega.delivery,
    invite_id: inviteRowId,
    action_link: entrega.action_link,
    message: entrega.message,
  })
})
