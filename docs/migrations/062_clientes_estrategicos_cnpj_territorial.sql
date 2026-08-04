-- 062 — a lista estratégica aceita CNPJ que ainda não é cliente de ninguém.
--
-- Motivo: a primeira carga real (corte 80/20 da Scantech, jan–jun/2026) traz
-- 1.327 CNPJs em 9 UFs. Só 57 estão na carteira do único parceiro cadastrado.
-- O valor do corte está justamente nos outros: lojas de alto volume que ainda
-- **não** atendemos. Com `cliente_id` e `distribuidor_id` obrigatórios, 96% da
-- lista não teria onde entrar.
--
-- O que muda:
--   1. `cnpj` passa a ser a **chave natural** da lista, sempre preenchido.
--      `cliente_id` vira conveniência resolvida, não pré-requisito.
--   2. `distribuidor_id` NULL = linha **territorial**: alvo do fornecedor, sem
--      dono. Nunca é preenchido automaticamente — uma linha territorial
--      continua territorial mesmo depois de virar cliente de alguém; o que ela
--      ganha é o vínculo `cliente_id`.
--   3. Dois gatilhos fazem a ligação nos dois sentidos: ao inserir na lista, e
--      quando o CNPJ entra numa carteira pela ingestão.
--
-- ⚠️ `cnpj` é `text`, não `char(14)`: a carteira real tem lojas cadastradas por
-- CPF (11 dígitos). Forçar 14 quebraria a carga.
--
-- Projeto canônico: osukbalwykbqvoumddxz

begin;

-- ─── 1. Colunas e obrigatoriedade ───────────────────────────────────────────

alter table public.alwayson_clientes_estrategicos
  alter column cliente_id      drop not null,
  alter column distribuidor_id drop not null,
  add column if not exists cnpj   text,
  add column if not exists cidade text,
  add column if not exists estado text;

-- Coerência das linhas que já existiam (hoje zero, mas a migration não assume).
update public.alwayson_clientes_estrategicos e
   set cnpj = c.cnpj
  from public.alwayson_clientes_distribuidor c
 where c.id = e.cliente_id
   and e.cnpj is null;

alter table public.alwayson_clientes_estrategicos
  alter column cnpj set not null;

comment on column public.alwayson_clientes_estrategicos.cnpj is
  'Chave natural da lista, só dígitos. Existe mesmo sem cliente na carteira. Text e não char(14): há lojas cadastradas por CPF.';
comment on column public.alwayson_clientes_estrategicos.distribuidor_id is
  'NULL = alvo territorial, sem parceiro dono. Nunca preenchido por gatilho.';
comment on column public.alwayson_clientes_estrategicos.cliente_id is
  'Preenchido por gatilho quando o CNPJ existe numa carteira. NULL = ainda não atendido.';

-- ─── 2. Unicidade ───────────────────────────────────────────────────────────
-- A chave antiga era (distribuidor_id, cliente_id) — inútil agora que ambos
-- podem ser NULL: UNIQUE não deduplica NULLs.

alter table public.alwayson_clientes_estrategicos
  drop constraint if exists alwayson_excelencia_clientes_distribuidor_id_cliente_id_key;

create unique index if not exists ux_alwayson_ce_cnpj_territorial
  on public.alwayson_clientes_estrategicos (cnpj)
  where distribuidor_id is null;

create unique index if not exists ux_alwayson_ce_cnpj_distribuidor
  on public.alwayson_clientes_estrategicos (distribuidor_id, cnpj)
  where distribuidor_id is not null;

-- ⚠️ Índices parciais: qualquer `ON CONFLICT` sobre eles precisa repetir o
-- predicado (`WHERE distribuidor_id IS NULL`), senão o Postgres devolve 42P10.

-- ─── 3. Gatilhos de ligação ─────────────────────────────────────────────────

create or replace function public.fn_alwayson_ce_normalizar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.cnpj := regexp_replace(coalesce(new.cnpj, ''), '\D', '', 'g');

  -- Veio pelo cliente: herda o CNPJ dele.
  if new.cnpj = '' and new.cliente_id is not null then
    select c.cnpj into new.cnpj
      from public.alwayson_clientes_distribuidor c
     where c.id = new.cliente_id;
    new.cnpj := regexp_replace(coalesce(new.cnpj, ''), '\D', '', 'g');
  end if;

  if new.cnpj = '' then
    raise exception 'Cliente estratégico exige CNPJ (ou um cliente que tenha um).';
  end if;

  -- Veio pelo CNPJ: liga ao cliente se ele já existir em alguma carteira.
  -- Não toca em distribuidor_id — territorial continua territorial.
  if new.cliente_id is null then
    select c.id into new.cliente_id
      from public.alwayson_clientes_distribuidor c
     where c.cnpj = new.cnpj
       and (new.distribuidor_id is null or c.distribuidor_id = new.distribuidor_id)
     order by c.criado_em nulls last
     limit 1;
  end if;

  new.estado := upper(nullif(trim(coalesce(new.estado, '')), ''));
  new.cidade := nullif(trim(coalesce(new.cidade, '')), '');

  return new;
end $$;

drop trigger if exists trg_alwayson_ce_normalizar on public.alwayson_clientes_estrategicos;
create trigger trg_alwayson_ce_normalizar
  before insert or update on public.alwayson_clientes_estrategicos
  for each row execute function public.fn_alwayson_ce_normalizar();

-- Sentido inverso: a ingestão cria o cliente → o alvo territorial deixa de ser
-- órfão sozinho. Sem isto, a lista envelheceria mostrando "fora da carteira"
-- para quem já virou cliente.
create or replace function public.fn_alwayson_ce_ligar_cliente_novo()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.alwayson_clientes_estrategicos e
     set cliente_id = new.id
   where e.cliente_id is null
     and e.cnpj = regexp_replace(coalesce(new.cnpj, ''), '\D', '', 'g')
     and (e.distribuidor_id is null or e.distribuidor_id = new.distribuidor_id);
  return null;
end $$;

drop trigger if exists trg_alwayson_ce_ligar_cliente_novo
  on public.alwayson_clientes_distribuidor;
create trigger trg_alwayson_ce_ligar_cliente_novo
  after insert on public.alwayson_clientes_distribuidor
  for each row execute function public.fn_alwayson_ce_ligar_cliente_novo();

-- ─── 4. RLS: linha territorial não tem distribuidor para filtrar ────────────
-- `current_user_distribuidor_escopo_ok(NULL)` é NULL → falha fechada, e a lista
-- territorial ficaria invisível a todos menos ao admin. Leitura passa a
-- admitir explicitamente a linha sem dono; a escrita nela continua só do admin.

drop policy if exists alwayson_clientes_estrategicos_select_escopo
  on public.alwayson_clientes_estrategicos;
create policy alwayson_clientes_estrategicos_select_escopo
  on public.alwayson_clientes_estrategicos
  for select to authenticated
  using (
    distribuidor_id is null
    or public.current_user_is_admin()
    or distribuidor_id in (
      select d.distribuidor_id from public.current_user_distribuidores_visiveis() d
    )
  );

drop policy if exists alwayson_clientes_estrategicos_insert_escopo
  on public.alwayson_clientes_estrategicos;
create policy alwayson_clientes_estrategicos_insert_escopo
  on public.alwayson_clientes_estrategicos
  for insert to authenticated
  with check (
    case when distribuidor_id is null
      then public.current_user_is_admin()
      else public.current_user_distribuidor_escopo_ok(distribuidor_id)
    end
  );

drop policy if exists alwayson_clientes_estrategicos_update_escopo
  on public.alwayson_clientes_estrategicos;
create policy alwayson_clientes_estrategicos_update_escopo
  on public.alwayson_clientes_estrategicos
  for update to authenticated
  using (
    case when distribuidor_id is null
      then public.current_user_is_admin()
      else public.current_user_distribuidor_escopo_ok(distribuidor_id)
    end
  )
  with check (
    case when distribuidor_id is null
      then public.current_user_is_admin()
      else public.current_user_distribuidor_escopo_ok(distribuidor_id)
    end
  );

drop policy if exists alwayson_clientes_estrategicos_delete_escopo
  on public.alwayson_clientes_estrategicos;
create policy alwayson_clientes_estrategicos_delete_escopo
  on public.alwayson_clientes_estrategicos
  for delete to authenticated
  using (
    case when distribuidor_id is null
      then public.current_user_is_admin()
      else public.current_user_distribuidor_escopo_ok(distribuidor_id)
    end
  );

-- ─── 5. View de leitura ─────────────────────────────────────────────────────
-- O nome do PDV **não** é gravado: resolve-se no momento da leitura a partir de
-- fonte pública (carteira do parceiro, Receita Federal via universo PDV, ou o
-- histórico territorial). Assim a lista fica legível sem armazenar dado de
-- terceiro.

create or replace view public.alwayson_clientes_estrategicos_v_lista
with (security_invoker = true) as
select
  e.*,
  coalesce(
    c.nome_fantasia, c.razao_social,
    u.nome_fantasia, u.razao_social,
    i.nome_cliente, i.razao_social
  )                                              as nome_exibicao,
  coalesce(e.cidade, c.cidade, u.municipio, i.cidade)  as cidade_exibicao,
  coalesce(e.estado, c.estado, u.uf, i.estado)         as estado_exibicao,
  (e.cliente_id is not null)                     as na_carteira,
  (u.cnpj is not null)                           as no_universo_pdv
from public.alwayson_clientes_estrategicos e
left join public.alwayson_clientes_distribuidor c on c.id = e.cliente_id
left join public.alwayson_pdv_universo          u on u.cnpj = e.cnpj
left join public.alwayson_insights_clientes     i on i.cnpj_14 = e.cnpj;

comment on view public.alwayson_clientes_estrategicos_v_lista is
  'Lista estratégica com nome e praça resolvidos por fonte pública na leitura — o nome do PDV não é armazenado.';

commit;
