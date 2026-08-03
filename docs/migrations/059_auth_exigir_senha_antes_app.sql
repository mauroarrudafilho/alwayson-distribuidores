-- Novos utilizadores nascem pending_invite; aceite + senha liberam acesso.
-- Projeto canônico: osukbalwykbqvoumddxz

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
    'pending_invite'
  )
  ON CONFLICT (user_id) DO UPDATE
    SET email = EXCLUDED.email,
        atualizado_em = now();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.alwayson_handle_new_user() IS
  'Cria perfil pending_invite ao registar auth.users — ativo só após aceitar convite e definir senha.';

-- Marcelio: convite aceito via link mágico sem senha — reexigir definição antes do app.
UPDATE auth.users
SET raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
  || jsonb_build_object('needs_password_setup', true)
WHERE lower(email) = lower('marceliomenezes@grupoarruda.com');

-- Invalida sessões abertas criadas pelo link de e-mail (JWT antigo não carrega o flag).
DELETE FROM auth.sessions
WHERE user_id IN (SELECT id FROM auth.users WHERE lower(email) = lower('marceliomenezes@grupoarruda.com'));

DELETE FROM auth.refresh_tokens
WHERE user_id IN (
  SELECT id::text FROM auth.users WHERE lower(email) = lower('marceliomenezes@grupoarruda.com')
);
