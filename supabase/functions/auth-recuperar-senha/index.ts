import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.99.1'
import { resolveAppOrigin } from '../_shared/app-origin.ts'
import { enviarAuthEmail } from '../_shared/auth-email-delivery.ts'
import { resendConfigurado } from '../_shared/resend-client.ts'

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405)
  }

  if (!resendConfigurado()) {
    return jsonResponse(
      {
        ok: false,
        error: 'resend_nao_configurado',
        message: 'Envio de e-mail indisponível. Contacte o administrador da plataforma.',
      },
      503,
    )
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!supabaseUrl || !serviceKey) {
    return jsonResponse({ ok: false, error: 'server_misconfigured' }, 500)
  }

  let body: Record<string, unknown> = {}
  try {
    const t = await req.text()
    if (t.trim()) body = JSON.parse(t) as Record<string, unknown>
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_json' }, 400)
  }

  const emailRaw = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!emailRaw || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
    return jsonResponse({ ok: false, error: 'email_invalido' }, 400)
  }

  const requestedOrigin =
    typeof body.app_origin === 'string' ? body.app_origin.trim().replace(/\/$/, '') : ''
  const originResolved = resolveAppOrigin(requestedOrigin)
  if (!originResolved.ok) {
    return jsonResponse(
      { ok: false, error: originResolved.error, message: originResolved.message },
      403,
    )
  }

  const adminSb = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const redirectTo = `${originResolved.origin}/redefinir-password`

  const { data: profile } = await adminSb
    .from('alwayson_user_profiles')
    .select('nome')
    .eq('email', emailRaw)
    .maybeSingle()

  const nome = typeof profile?.nome === 'string' ? profile.nome.trim() : undefined

  const { data: linkData, error: linkErr } = await adminSb.auth.admin.generateLink({
    type: 'recovery',
    email: emailRaw,
    options: { redirectTo },
  })

  const actionLink = linkData?.properties?.action_link ?? null

  if (actionLink && !linkErr) {
    const envio = await enviarAuthEmail({
      variant: 'recuperar_senha',
      email: emailRaw,
      actionLink,
      nome: nome || undefined,
    })
    if (!envio.ok) {
      console.error('auth-recuperar-senha resend:', envio.message)
      return jsonResponse(
        {
          ok: false,
          error: 'email_envio_falhou',
          message: envio.message ?? 'Falha ao enviar e-mail.',
        },
        502,
      )
    }
  } else if (linkErr) {
    // Não vazar existência de conta — log interno apenas
    console.warn('auth-recuperar-senha generateLink:', linkErr.message)
  }

  return jsonResponse({
    ok: true,
    message:
      'Se este e-mail tiver conta na plataforma, você receberá instruções nos próximos minutos.',
  })
})
