-- Auth multi-tenant: tenants, profiles (espelho de auth.users), memberships e convites.
-- Cobertura mínima da Fase 1; permissões finas vêm na Fase 2.
--
-- Projeto canônico: osukbalwykbqvoumddxz

-- ─── 1. ENUMS ────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'alwayson_tenant_tipo') THEN
    CREATE TYPE alwayson_tenant_tipo AS ENUM ('admin_global','fornecedor','distribuidor');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'alwayson_membership_role') THEN
    CREATE TYPE alwayson_membership_role AS ENUM (
      'admin','gestor','gestor_cliente','gestor_fornecedor',
      'vendedor','supervisor','gerente'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'alwayson_user_status') THEN
    CREATE TYPE alwayson_user_status AS ENUM ('active','pending_invite','suspended');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'alwayson_invite_status') THEN
    CREATE TYPE alwayson_invite_status AS ENUM ('pending','accepted','expired','revoked');
  END IF;
END$$;

-- ─── 2. TENANTS ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS alwayson_tenants (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo            alwayson_tenant_tipo NOT NULL,
  nome            text NOT NULL,
  slug            text NOT NULL UNIQUE,
  distribuidor_id uuid REFERENCES alwayson_distribuidores(id) ON DELETE SET NULL,
  ativo           boolean NOT NULL DEFAULT true,
  criado_em       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE alwayson_tenants IS
  'Organizações que acessam a plataforma: admin global (Arruda), fornecedor (Vinícola Campestre) ou distribuidor.';

CREATE INDEX IF NOT EXISTS idx_alwayson_tenants_tipo ON alwayson_tenants (tipo);
CREATE INDEX IF NOT EXISTS idx_alwayson_tenants_distribuidor ON alwayson_tenants (distribuidor_id);

-- ─── 3. USER PROFILES (espelho de auth.users) ───────────────────────────────

CREATE TABLE IF NOT EXISTS alwayson_user_profiles (
  user_id      uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email        text,
  nome         text,
  status       alwayson_user_status NOT NULL DEFAULT 'pending_invite',
  criado_em    timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE alwayson_user_profiles IS
  'Perfil estendido do utilizador AlwaysOn (1:1 com auth.users).';

CREATE INDEX IF NOT EXISTS idx_alwayson_user_profiles_email ON alwayson_user_profiles (lower(email));

-- Trigger que cria profile automaticamente ao novo user em auth.users
CREATE OR REPLACE FUNCTION public.alwayson_handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.alwayson_user_profiles (user_id, email, nome, status)
  VALUES (
    NEW.id,
    NEW.email,
    coalesce(NEW.raw_user_meta_data ->> 'nome', NEW.email),
    'active'
  )
  ON CONFLICT (user_id) DO UPDATE
    SET email = EXCLUDED.email,
        atualizado_em = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS alwayson_on_auth_user_created ON auth.users;
CREATE TRIGGER alwayson_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.alwayson_handle_new_user();

-- ─── 4. MEMBERSHIPS ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS alwayson_memberships (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id      uuid NOT NULL REFERENCES alwayson_tenants(id) ON DELETE CASCADE,
  role           alwayson_membership_role NOT NULL,
  escopo         jsonb NOT NULL DEFAULT '{}'::jsonb,
  ativo          boolean NOT NULL DEFAULT true,
  convidado_por  uuid REFERENCES auth.users(id),
  criado_em      timestamptz NOT NULL DEFAULT now(),
  aceito_em      timestamptz,
  UNIQUE (user_id, tenant_id, role)
);

COMMENT ON TABLE alwayson_memberships IS
  'Vínculo user ↔ tenant ↔ role. Escopo guarda restrições adicionais (ex.: cnpjs_cliente, codigo_vendedor).';

CREATE INDEX IF NOT EXISTS idx_alwayson_memberships_user ON alwayson_memberships (user_id);
CREATE INDEX IF NOT EXISTS idx_alwayson_memberships_tenant ON alwayson_memberships (tenant_id);

-- ─── 5. CONVITES ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS alwayson_user_invites (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email          text NOT NULL,
  tenant_id      uuid NOT NULL REFERENCES alwayson_tenants(id) ON DELETE CASCADE,
  role           alwayson_membership_role NOT NULL,
  escopo         jsonb NOT NULL DEFAULT '{}'::jsonb,
  token          text NOT NULL UNIQUE,
  status         alwayson_invite_status NOT NULL DEFAULT 'pending',
  convidado_por  uuid REFERENCES auth.users(id),
  criado_em      timestamptz NOT NULL DEFAULT now(),
  expira_em      timestamptz NOT NULL DEFAULT now() + interval '14 days',
  usado_em       timestamptz
);

COMMENT ON TABLE alwayson_user_invites IS
  'Convites pendentes a aceitar via /aceitar-convite/:token; alimenta criação de membership.';

CREATE INDEX IF NOT EXISTS idx_alwayson_user_invites_email ON alwayson_user_invites (lower(email));
CREATE INDEX IF NOT EXISTS idx_alwayson_user_invites_status ON alwayson_user_invites (status);

-- ─── 6. RPCs HELPER (SECURITY DEFINER) ──────────────────────────────────────

-- True quando o utilizador atual tem ao menos um membership ativo de role 'admin'
-- num tenant do tipo 'admin_global'.
CREATE OR REPLACE FUNCTION public.current_user_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM alwayson_memberships m
    INNER JOIN alwayson_tenants t ON t.id = m.tenant_id
    WHERE m.user_id = auth.uid()
      AND m.role = 'admin'
      AND m.ativo = true
      AND t.tipo = 'admin_global'
      AND t.ativo = true
  );
$$;

-- Tenants ativos do utilizador atual (com membership ativo).
CREATE OR REPLACE FUNCTION public.current_user_tenants()
RETURNS TABLE (
  tenant_id   uuid,
  tipo        alwayson_tenant_tipo,
  nome        text,
  slug        text,
  role        alwayson_membership_role,
  escopo      jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.id, t.tipo, t.nome, t.slug, m.role, m.escopo
  FROM alwayson_memberships m
  INNER JOIN alwayson_tenants t ON t.id = m.tenant_id
  WHERE m.user_id = auth.uid()
    AND m.ativo = true
    AND t.ativo = true
  ORDER BY t.tipo, t.nome;
$$;

REVOKE ALL ON FUNCTION public.current_user_is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_is_admin() TO authenticated;
REVOKE ALL ON FUNCTION public.current_user_tenants() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_tenants() TO authenticated;

-- Aceita um convite usando o token, vincula ao auth.uid() atual.
CREATE OR REPLACE FUNCTION public.alwayson_accept_invite(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv      alwayson_user_invites%ROWTYPE;
  uemail   text;
  uid      uuid := auth.uid();
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

  INSERT INTO alwayson_memberships (user_id, tenant_id, role, escopo, convidado_por, aceito_em, ativo)
  VALUES (uid, inv.tenant_id, inv.role, inv.escopo, inv.convidado_por, now(), true)
  ON CONFLICT (user_id, tenant_id, role) DO UPDATE
    SET escopo = EXCLUDED.escopo,
        ativo = true,
        aceito_em = now();

  UPDATE alwayson_user_invites
     SET status = 'accepted', usado_em = now()
   WHERE id = inv.id;

  UPDATE alwayson_user_profiles
     SET status = 'active', atualizado_em = now()
   WHERE user_id = uid;

  RETURN jsonb_build_object('ok', true, 'tenant_id', inv.tenant_id, 'role', inv.role);
END;
$$;

REVOKE ALL ON FUNCTION public.alwayson_accept_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.alwayson_accept_invite(text) TO authenticated;

-- ─── 7. RLS ─────────────────────────────────────────────────────────────────

ALTER TABLE alwayson_tenants            ENABLE ROW LEVEL SECURITY;
ALTER TABLE alwayson_user_profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE alwayson_memberships        ENABLE ROW LEVEL SECURITY;
ALTER TABLE alwayson_user_invites       ENABLE ROW LEVEL SECURITY;

-- Tenants visíveis ao utilizador autenticado: aqueles em que tem membership; admin global vê todos.
DROP POLICY IF EXISTS alwayson_tenants_select_member ON alwayson_tenants;
CREATE POLICY alwayson_tenants_select_member
  ON alwayson_tenants FOR SELECT TO authenticated
  USING (
    public.current_user_is_admin()
    OR id IN (
      SELECT tenant_id FROM alwayson_memberships
      WHERE user_id = auth.uid() AND ativo = true
    )
  );

-- Profiles: o próprio user lê o seu profile; admin lê todos.
DROP POLICY IF EXISTS alwayson_user_profiles_self_or_admin ON alwayson_user_profiles;
CREATE POLICY alwayson_user_profiles_self_or_admin
  ON alwayson_user_profiles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.current_user_is_admin());

DROP POLICY IF EXISTS alwayson_user_profiles_self_update ON alwayson_user_profiles;
CREATE POLICY alwayson_user_profiles_self_update
  ON alwayson_user_profiles FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Memberships: o próprio user vê os seus; admin vê todos.
DROP POLICY IF EXISTS alwayson_memberships_self_or_admin ON alwayson_memberships;
CREATE POLICY alwayson_memberships_self_or_admin
  ON alwayson_memberships FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.current_user_is_admin());

-- Convites: só admin global lê/altera.
DROP POLICY IF EXISTS alwayson_user_invites_admin ON alwayson_user_invites;
CREATE POLICY alwayson_user_invites_admin
  ON alwayson_user_invites FOR ALL TO authenticated
  USING (public.current_user_is_admin())
  WITH CHECK (public.current_user_is_admin());

-- ─── 8. SEED — Arruda (admin_global) e Vinícola Campestre (fornecedor) ──────

INSERT INTO alwayson_tenants (tipo, nome, slug)
VALUES ('admin_global', 'Grupo Arruda', 'arruda')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO alwayson_tenants (tipo, nome, slug)
VALUES ('fornecedor', 'Vinícola Campestre', 'vinicola-campestre')
ON CONFLICT (slug) DO NOTHING;
