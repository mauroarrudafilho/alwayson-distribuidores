-- 052 — Excelência vira Clientes Estratégicos
--
-- Decisão de produto: o módulo deixa de ser "plano de excelência com critérios"
-- e passa a ser uma **lista curada** de clientes que o time considera
-- estratégicos — cada um com o **seu** motivo específico — que entram num fluxo
-- de acompanhamento próprio.
--
-- O que muda:
--   1. As três tabelas `alwayson_excelencia_*` são renomeadas para
--      `alwayson_clientes_estrategicos*`. As três estavam **vazias** (0 linhas
--      em 2026-08-02), então o rename é livre de risco de dado.
--   2. A lista ganha os campos que a tornam curadoria e não flag: `motivo`
--      (obrigatório na prática — é o que o produto pede), `origem`,
--      `prioridade`, `observacao` e autoria.
--   3. A tabela deixa de ser somente-leitura: ganha INSERT/UPDATE/DELETE
--      gated por `current_user_is_admin()`, seguindo o padrão das migrations
--      028/035/044. Hoje só o admin curam a lista — se isso abrir para o KAM,
--      é aqui que a policy muda.
--
-- Sem `fornecedor_tenant_id` de propósito: cliente é do distribuidor, não do
-- fornecedor — mesma regra de `alwayson_clientes_distribuidor` (migration 047).

begin;

-- ---------------------------------------------------------------------------
-- 1. Rename das tabelas
-- ---------------------------------------------------------------------------

alter table if exists public.alwayson_excelencia_clientes
  rename to alwayson_clientes_estrategicos;

alter table if exists public.alwayson_excelencia_config
  rename to alwayson_clientes_estrategicos_config;

alter table if exists public.alwayson_excelencia_criterios
  rename to alwayson_clientes_estrategicos_criterios;

-- Policies acompanham a tabela no rename, mas mantêm o nome antigo.
alter policy alwayson_excelencia_clientes_select_escopo
  on public.alwayson_clientes_estrategicos
  rename to alwayson_clientes_estrategicos_select_escopo;

alter policy alwayson_excelencia_config_select_escopo
  on public.alwayson_clientes_estrategicos_config
  rename to alwayson_clientes_estrategicos_config_select_escopo;

alter policy alwayson_excelencia_criterios_select_escopo
  on public.alwayson_clientes_estrategicos_criterios
  rename to alwayson_clientes_estrategicos_criterios_select_escopo;

-- ---------------------------------------------------------------------------
-- 2. Campos da curadoria
-- ---------------------------------------------------------------------------

alter table public.alwayson_clientes_estrategicos
  add column if not exists motivo         text,
  add column if not exists origem         text,
  add column if not exists prioridade     text not null default 'media',
  add column if not exists observacao     text,
  add column if not exists adicionado_por uuid references auth.users(id),
  add column if not exists atualizado_em  timestamptz not null default now(),
  add column if not exists removido_em    timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.alwayson_clientes_estrategicos'::regclass
      and conname = 'alwayson_clientes_estrategicos_prioridade_check'
  ) then
    alter table public.alwayson_clientes_estrategicos
      add constraint alwayson_clientes_estrategicos_prioridade_check
      check (prioridade in ('alta', 'media', 'baixa'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.alwayson_clientes_estrategicos'::regclass
      and conname = 'alwayson_clientes_estrategicos_origem_check'
  ) then
    -- Lista fechada porque a origem alimenta filtro e leitura de carteira;
    -- texto livre vira 'outro' + observacao.
    alter table public.alwayson_clientes_estrategicos
      add constraint alwayson_clientes_estrategicos_origem_check
      check (origem is null or origem in (
        'scantech', 'indicacao', 'decisao_comercial', 'rede', 'potencial', 'outro'
      ));
  end if;
end $$;

comment on table public.alwayson_clientes_estrategicos is
  'Lista curada de clientes estratégicos: cadastro manual, um motivo por cliente. Não é derivada de faturamento.';
comment on column public.alwayson_clientes_estrategicos.motivo is
  'Por que ESTE cliente é estratégico. É o campo que dá sentido à lista — sem ele a linha é ruído.';
comment on column public.alwayson_clientes_estrategicos.origem is
  'De onde veio a indicação: scantech | indicacao | decisao_comercial | rede | potencial | outro.';
comment on column public.alwayson_clientes_estrategicos.removido_em is
  'Saída da lista é soft (ativo=false + carimbo), para preservar o histórico de curadoria.';

-- Mantém `atualizado_em` honesto sem depender do cliente.
create or replace function public.fn_alwayson_clientes_estrategicos_touch()
returns trigger
language plpgsql
-- search_path fixo: sem isto o linter marca function_search_path_mutable.
set search_path = ''
as $$
begin
  new.atualizado_em := now();
  return new;
end $$;

drop trigger if exists trg_alwayson_clientes_estrategicos_touch
  on public.alwayson_clientes_estrategicos;
create trigger trg_alwayson_clientes_estrategicos_touch
  before update on public.alwayson_clientes_estrategicos
  for each row execute function public.fn_alwayson_clientes_estrategicos_touch();

-- ---------------------------------------------------------------------------
-- 3. Escrita — admin
-- ---------------------------------------------------------------------------

drop policy if exists alwayson_clientes_estrategicos_insert_admin
  on public.alwayson_clientes_estrategicos;
create policy alwayson_clientes_estrategicos_insert_admin
  on public.alwayson_clientes_estrategicos
  for insert to authenticated
  with check (public.current_user_is_admin());

drop policy if exists alwayson_clientes_estrategicos_update_admin
  on public.alwayson_clientes_estrategicos;
create policy alwayson_clientes_estrategicos_update_admin
  on public.alwayson_clientes_estrategicos
  for update to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

drop policy if exists alwayson_clientes_estrategicos_delete_admin
  on public.alwayson_clientes_estrategicos;
create policy alwayson_clientes_estrategicos_delete_admin
  on public.alwayson_clientes_estrategicos
  for delete to authenticated
  using (public.current_user_is_admin());

-- Critérios de acompanhamento seguem a mesma régua de curadoria.
drop policy if exists alwayson_clientes_estrategicos_config_write_admin
  on public.alwayson_clientes_estrategicos_config;
create policy alwayson_clientes_estrategicos_config_write_admin
  on public.alwayson_clientes_estrategicos_config
  for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

-- ---------------------------------------------------------------------------
-- 4. Metas: o tipo passa a chamar-se clientes_estrategicos
-- ---------------------------------------------------------------------------

update public.alwayson_metas_distribuidor
   set tipo = 'clientes_estrategicos'
 where tipo = 'clientes_excelencia';

alter table public.alwayson_metas_distribuidor
  drop constraint if exists alwayson_metas_distribuidor_tipo_check;

alter table public.alwayson_metas_distribuidor
  add constraint alwayson_metas_distribuidor_tipo_check
  check (tipo in ('faturamento', 'positivacao', 'mix', 'clientes_estrategicos'));

commit;
