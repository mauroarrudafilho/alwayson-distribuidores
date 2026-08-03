-- Migration 057 — convite pode criar vários vínculos (fornecedor × distribuidor).
--
-- O escopo de acesso é definido por memberships em tenants de fornecedor e/ou
-- distribuidor (migration 048). Um KAM da Campestre no Paraty precisa de dois
-- vínculos; gestor_fornecedor só no fornecedor; equipa do distribuidor só no
-- parceiro. O convite guarda a lista em escopo.memberships e o aceite cria todos.
--
-- Projeto canônico: osukbalwykbqvoumddxz

CREATE OR REPLACE FUNCTION public.alwayson_accept_invite(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  uemail text;
  inv alwayson_user_invites%ROWTYPE;
  m jsonb;
  created int := 0;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'nao_autenticado');
  END IF;

  SELECT email INTO uemail FROM auth.users WHERE id = uid;

  SELECT * INTO inv FROM alwayson_user_invites
   WHERE token = p_token
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'token_invalido');
  END IF;

  IF inv.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'convite_ja_utilizado_ou_revogado');
  END IF;

  IF inv.expira_em < now() THEN
    UPDATE alwayson_user_invites SET status = 'expired' WHERE id = inv.id;
    RETURN jsonb_build_object('ok', false, 'error', 'convite_expirado');
  END IF;

  IF lower(coalesce(uemail, '')) <> lower(coalesce(inv.email, '')) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'email_nao_corresponde');
  END IF;

  IF jsonb_typeof(inv.escopo -> 'memberships') = 'array'
     AND jsonb_array_length(inv.escopo -> 'memberships') > 0 THEN
    FOR m IN SELECT * FROM jsonb_array_elements(inv.escopo -> 'memberships')
    LOOP
      INSERT INTO alwayson_memberships (user_id, tenant_id, role, escopo, convidado_por, aceito_em, ativo)
      VALUES (
        uid,
        (m ->> 'tenant_id')::uuid,
        (m ->> 'role')::alwayson_membership_role,
        coalesce(m -> 'escopo', '{}'::jsonb),
        inv.convidado_por,
        now(),
        true
      )
      ON CONFLICT (user_id, tenant_id, role) DO UPDATE
        SET escopo = EXCLUDED.escopo,
            ativo = true,
            aceito_em = now();
      created := created + 1;
    END LOOP;
  ELSE
    INSERT INTO alwayson_memberships (user_id, tenant_id, role, escopo, convidado_por, aceito_em, ativo)
    VALUES (uid, inv.tenant_id, inv.role, inv.escopo, inv.convidado_por, now(), true)
    ON CONFLICT (user_id, tenant_id, role) DO UPDATE
      SET escopo = EXCLUDED.escopo,
          ativo = true,
          aceito_em = now();
    created := 1;
  END IF;

  UPDATE alwayson_user_invites
     SET status = 'accepted', usado_em = now()
   WHERE id = inv.id;

  UPDATE alwayson_user_profiles
     SET status = 'active', atualizado_em = now()
   WHERE user_id = uid;

  RETURN jsonb_build_object(
    'ok', true,
    'tenant_id', inv.tenant_id,
    'role', inv.role,
    'memberships_created', created
  );
END;
$$;

COMMENT ON FUNCTION public.alwayson_accept_invite(text) IS
  'Aceita convite pendente. Se escopo.memberships existir, cria todos os vínculos; senão mantém o caminho legado (um tenant).';
