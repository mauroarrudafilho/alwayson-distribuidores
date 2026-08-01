import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.99.1'

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

function corpoConvite(actionLink: string, nome?: string): string {
  const saudacao = nome ? `Olá, ${nome}!` : 'Olá!'
  return `
    <div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a">
      <h2 style="font-size:18px;margin:0 0 16px">${saudacao}</h2>
      <p style="font-size:14px;line-height:1.6;margin:0 0 16px">
        Você foi convidado para a plataforma <strong>AlwaysOn Distribuidores</strong>.
        Clique abaixo para definir o seu acesso.
      </p>
      <p style="margin:24px 0">
        <a href="${actionLink}"
           style="background:#1a1a1a;color:#fff;text-decoration:none;padding:11px 20px;border-radius:6px;font-size:14px;display:inline-block">
          Aceitar convite
        </a>
      </p>
      <p style="font-size:12px;color:#666;line-height:1.6;margin:0">
        Se o botão não funcionar, copie e cole este endereço no navegador:<br>
        <span style="word-break:break-all">${actionLink}</span>
      </p>
    </div>`
}

/**
 * Entrega o convite pelo Resend. Opt-in: sem `RESEND_API_KEY` a função mantém o
 * caminho antigo (e-mail nativo do Supabase), então publicar isto não altera
 * comportamento enquanto o segredo não estiver definido.
 */
async function enviarPorResend(
  email: string,
  actionLink: string,
  nome?: string,
): Promise<{ ok: boolean; message?: string }> {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey) return { ok: false, message: 'RESEND_API_KEY não definida' }
  const from = Deno.env.get('RESEND_FROM') ?? 'AlwaysOn <onboarding@resend.dev>'

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [email],
        subject: 'Seu acesso ao AlwaysOn Distribuidores',
        html: corpoConvite(actionLink, nome),
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
    'kam',
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

  // ─── Entrega por Resend (quando configurado) ──────────────────────────────
  // Gera o link sem disparar o e-mail nativo e entrega pelo Resend, que tem
  // domínio verificado e limites de produção — o e-mail embutido do Supabase
  // serve para desenvolvimento, não para convidar parceiros.
  if (Deno.env.get('RESEND_API_KEY')) {
    let actionLink: string | null = null

    const convite = await adminSb.auth.admin.generateLink({
      type: 'invite',
      email,
      options: { redirectTo, data: nome ? { nome } : undefined },
    })

    if (convite.data?.properties?.action_link) {
      actionLink = convite.data.properties.action_link
    } else if (looksRegisteredError(convite.error?.message ?? '')) {
      // Já tem conta: link mágico leva ao login e depois ao aceite.
      const ml = await adminSb.auth.admin.generateLink({
        type: 'magiclink',
        email,
        options: { redirectTo },
      })
      actionLink = ml.data?.properties?.action_link ?? null
    }

    if (!actionLink) {
      await deleteInvite(adminSb, inviteRowId)
      console.error('generateLink (resend):', convite.error?.message)
      return jsonResponse(
        { ok: false, error: 'link_falhou', message: convite.error?.message ?? 'Sem action_link' },
        502,
      )
    }

    const envio = await enviarPorResend(email, actionLink, nome)
    if (envio.ok) {
      return jsonResponse({
        ok: true,
        delivery: 'resend',
        invite_id: inviteRowId,
        message: 'Convite enviado por e-mail (Resend).',
      })
    }

    // Resend falhou: o convite continua válido, então devolve o link em vez de
    // descartar o trabalho — o admin envia manualmente.
    console.error('resend:', envio.message)
    return jsonResponse({
      ok: true,
      delivery: 'manual',
      invite_id: inviteRowId,
      action_link: actionLink,
      message: `Não foi possível enviar pelo Resend (${envio.message}). Copie o link e envie manualmente.`,
    })
  }

  // ─── Caminho original: e-mail nativo do Supabase ──────────────────────────
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
