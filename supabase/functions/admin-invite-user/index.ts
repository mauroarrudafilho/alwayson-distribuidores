import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.99.1'

type MembershipRole =
  | 'admin'
  | 'gestor'
  | 'gestor_cliente'
  | 'gestor_fornecedor'
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

function parseAllowedOrigins(): string[] {
  const extra = (Deno.env.get('ALLOWED_APP_ORIGINS') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const merged = [...DEFAULT_ALLOWED_ORIGINS, ...extra]
  return [...new Set(merged)]
}

function isRole(v: unknown): v is MembershipRole {
  const roles: MembershipRole[] = [
    'admin',
    'gestor',
    'gestor_cliente',
    'gestor_fornecedor',
    'vendedor',
    'supervisor',
    'gerente',
  ]
  return typeof v === 'string' && roles.includes(v as MembershipRole)
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

  const emailRaw = typeof body.email === 'string' ? body.email.trim() : ''
  const email = emailRaw.toLowerCase()
  const tenant_id = typeof body.tenant_id === 'string' ? body.tenant_id.trim() : ''
  const nome = typeof body.nome === 'string' ? body.nome.trim() : ''
  const app_origin =
    typeof body.app_origin === 'string' ? body.app_origin.trim().replace(/\/$/, '') : ''

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonResponse({ ok: false, error: 'email_invalido' }, 400)
  }
  if (!tenant_id) {
    return jsonResponse({ ok: false, error: 'tenant_id_obrigatorio' }, 400)
  }
  if (!isRole(body.role)) {
    return jsonResponse({ ok: false, error: 'role_invalida' }, 400)
  }
  const role = body.role

  const allowed = parseAllowedOrigins()
  if (!app_origin || !allowed.includes(app_origin)) {
    return jsonResponse(
      {
        ok: false,
        error: 'origin_nao_autorizada',
        message:
          'app_origin deve ser a origem exata da aplicação e estar na lista permitida na função.',
      },
      403,
    )
  }

  const adminSb = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

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
  const redirectTo = `${app_origin}/aceitar-convite/${token}`

  const { data: inserted, error: insErr } = await adminSb
    .from('alwayson_user_invites')
    .insert({
      email,
      tenant_id,
      role,
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

  const { error: inviteEmailErr } = await adminSb.auth.admin.inviteUserByEmail(email, {
    data: nome ? { nome } : undefined,
    redirectTo,
  })

  if (!inviteEmailErr) {
    return jsonResponse({
      ok: true,
      delivery: 'signup_email',
      invite_id: inviteRowId,
      message: 'Convite enviado por e-mail (Supabase Auth).',
    })
  }

  const em = inviteEmailErr.message ?? ''
  console.error('inviteUserByEmail:', em)

  if (!looksRegisteredError(em)) {
    return jsonResponse(
      {
        ok: false,
        error: 'email_envio_falhou',
        message: em,
        invite_id: inviteRowId,
        hint: 'O registo do convite ficou pendente na base de dados. Revogue na UI se quiser cancelar, ou corrija a configuração de e-mail no Supabase.',
      },
      502,
    )
  }

  const { data: linkData, error: linkErr } = await adminSb.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo },
  })

  if (linkErr || !linkData?.properties?.action_link) {
    await deleteInvite(adminSb, inviteRowId)
    console.error('generateLink magiclink:', linkErr?.message)
    return jsonResponse(
      {
        ok: false,
        error: 'magiclink_falhou',
        message: linkErr?.message ?? 'Sem action_link',
      },
      502,
    )
  }

  return jsonResponse({
    ok: true,
    delivery: 'magiclink',
    invite_id: inviteRowId,
    action_link: linkData.properties.action_link,
    message:
      'Este e-mail já tem conta. Copie o link mágico e envie manualmente — abre login e redireciona para aceitar o convite.',
  })
})
