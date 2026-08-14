-- Migration 073 — recebimento automático por distribuidor (Pacote G, fase 1).
--
-- Canal 1: e-mail dedicado (CloudMailin) → webhook → ingest. Duas tabelas:
--
--   1. alwayson_distribuidor_recebimento — config de recebimento por par
--      (distribuidor, fornecedor): endereço de e-mail, tipos esperados e modo
--      validação. É o "pré-carregamento": registrado o endereço, o webhook
--      resolve o recorte sem tocar em credencial do parceiro.
--
--   2. alwayson_distribuidor_service_tokens — credencial de máquina com escopo
--      distribuidor+fornecedor, revogável. Só o HASH (sha256) é guardado; o
--      texto puro sai uma única vez pela função fn_alwayson_service_token_criar.
--      A decisão de acesso continua no contexto do chamador (padrão da API de
--      ingestão) — a chave nunca substitui o service_role.
--
-- Projeto canônico: osukbalwykbqvoumddxz

create extension if not exists pgcrypto;

-- ─── 1. Config de recebimento por (distribuidor, fornecedor) ────────────────

create table if not exists public.alwayson_distribuidor_recebimento (
  id                   uuid primary key default gen_random_uuid(),
  distribuidor_id      uuid not null references public.alwayson_distribuidores(id) on delete cascade,
  fornecedor_tenant_id uuid not null references public.alwayson_tenants(id) on delete cascade,
  -- Padrão: {nome_distribuidor}.{cnpj_raiz_fornecedor}@alwayson.com.br
  email_recebimento    text not null,
  tipos_esperados      text[] not null default '{vendas,estoque,clientes}',
  modo_validacao       boolean not null default true,
  ativo                boolean not null default true,
  observacao           text,
  criado_por           uuid references auth.users(id),
  atualizado_por       uuid references auth.users(id),
  criado_em            timestamptz not null default now(),
  atualizado_em        timestamptz not null default now(),
  constraint uq_recebimento_email unique (email_recebimento),
  constraint uq_recebimento_par   unique (distribuidor_id, fornecedor_tenant_id),
  constraint ck_recebimento_tipos check (tipos_esperados <@ array['vendas','estoque','clientes'])
);

comment on table public.alwayson_distribuidor_recebimento is
  'Recebimento automático por par (distribuidor, fornecedor): endereço de e-mail, tipos esperados e modo validação.';

-- O endereço só faz sentido para um par com relação ativa no fornecedor.
create or replace function public.fn_alwayson_recebimento_valida_fornecedor()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.alwayson_fornecedor_distribuidores fd
    where fd.distribuidor_id      = new.distribuidor_id
      and fd.fornecedor_tenant_id = new.fornecedor_tenant_id
      and fd.ativo
  ) then
    raise exception 'Par distribuidor/fornecedor sem relação ativa em alwayson_fornecedor_distribuidores.';
  end if;
  new.atualizado_em := now();
  return new;
end;
$$;

drop trigger if exists trg_alwayson_recebimento_valida on public.alwayson_distribuidor_recebimento;
create trigger trg_alwayson_recebimento_valida
  before insert or update on public.alwayson_distribuidor_recebimento
  for each row execute function public.fn_alwayson_recebimento_valida_fornecedor();

alter table public.alwayson_distribuidor_recebimento enable row level security;

-- Leitura por escopo — mesma régua de dois eixos das tabelas de negócio (048).
create policy alwayson_distribuidor_recebimento_select_escopo
  on public.alwayson_distribuidor_recebimento
  for select to authenticated
  using (
    distribuidor_id IN (SELECT d.distribuidor_id FROM public.current_user_distribuidores_visiveis() d)
    AND fornecedor_tenant_id IN (SELECT f.tenant_id FROM public.current_user_fornecedores_visiveis() f)
  );

-- Escrita operacional no recorte do KAM (mesma régua da migration 061).
create policy alwayson_distribuidor_recebimento_write_escopo
  on public.alwayson_distribuidor_recebimento
  for all to authenticated
  using (public.current_user_distribuidor_escopo_ok(distribuidor_id))
  with check (public.current_user_distribuidor_escopo_ok(distribuidor_id));

-- ─── 2. Tokens de serviço (credencial de máquina por distribuidor) ──────────

create table if not exists public.alwayson_distribuidor_service_tokens (
  id                   uuid primary key default gen_random_uuid(),
  distribuidor_id      uuid not null references public.alwayson_distribuidores(id) on delete cascade,
  fornecedor_tenant_id uuid not null references public.alwayson_tenants(id) on delete cascade,
  token_hash           text not null,
  rotulo               text,
  ativo                boolean not null default true,
  ultimo_uso_em        timestamptz,
  revogado_em          timestamptz,
  criado_por           uuid references auth.users(id),
  criado_em            timestamptz not null default now(),
  constraint uq_service_token_hash unique (token_hash)
);

create index if not exists idx_service_tokens_par
  on public.alwayson_distribuidor_service_tokens (distribuidor_id, fornecedor_tenant_id);

comment on table public.alwayson_distribuidor_service_tokens is
  'Credencial de máquina por par (distribuidor, fornecedor). Só o hash sha256 é guardado; o texto puro sai uma única vez na criação.';

alter table public.alwayson_distribuidor_service_tokens enable row level security;

-- Só admin enxerga/revoga. O hash não é exposto a outros perfis (permite
-- verificar token offline se vazar).
create policy alwayson_distribuidor_service_tokens_admin_select
  on public.alwayson_distribuidor_service_tokens
  for select to authenticated
  using (public.current_user_is_admin());

create policy alwayson_distribuidor_service_tokens_admin_update
  on public.alwayson_distribuidor_service_tokens
  for update to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

create policy alwayson_distribuidor_service_tokens_admin_delete
  on public.alwayson_distribuidor_service_tokens
  for delete to authenticated
  using (public.current_user_is_admin());

-- Criação acontece só por função (SECURITY DEFINER) — insere o hash, devolve o
-- texto puro uma única vez.
create or replace function public.fn_alwayson_service_token_criar(
  p_distribuidor_id      uuid,
  p_fornecedor_tenant_id uuid,
  p_rotulo               text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
  v_hash  text;
begin
  if not public.current_user_is_admin() then
    raise exception 'Apenas admin cria tokens de serviço.';
  end if;

  if not exists (
    select 1
    from public.alwayson_fornecedor_distribuidores fd
    where fd.distribuidor_id      = p_distribuidor_id
      and fd.fornecedor_tenant_id = p_fornecedor_tenant_id
      and fd.ativo
  ) then
    raise exception 'Par distribuidor/fornecedor sem relação ativa em alwayson_fornecedor_distribuidores.';
  end if;

  v_token := 'sk_' || encode(gen_random_bytes(32), 'hex');
  v_hash  := encode(digest(v_token, 'sha256'), 'hex');

  insert into public.alwayson_distribuidor_service_tokens
    (distribuidor_id, fornecedor_tenant_id, token_hash, rotulo, criado_por)
  values
    (p_distribuidor_id, p_fornecedor_tenant_id, v_hash, p_rotulo, auth.uid());

  return v_token;
end;
$$;

comment on function public.fn_alwayson_service_token_criar(uuid, uuid, text) is
  'Gera um token de serviço para o par (distribuidor, fornecedor) e devolve o texto puro UMA única vez; só o hash fica no banco.';

revoke all on function public.fn_alwayson_service_token_criar(uuid, uuid, text) from public;
grant execute on function public.fn_alwayson_service_token_criar(uuid, uuid, text) to authenticated;
