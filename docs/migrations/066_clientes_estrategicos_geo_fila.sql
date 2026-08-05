-- 066 — fila de geocodificação da lista estratégica (mesmo padrão do Insights).
--
-- Por que esta migration existe: o complemento de geo dos clientes **já tinha
-- um caminho neste projeto** — a dimensão `alwayson_insights_clientes` tem
-- `brasil_enriquecimento_status` e é enriquecida por uma **Edge Function**
-- (`process-insights-pendentes`), que consulta Receita/BrasilAPI e o geocoder a
-- partir da infra do Supabase. O script local `estrategicos:enrich-geo` exigia
-- uma máquina com saída para a internet; a fila + worker não exige.
--
-- Aqui replica-se o mesmo contrato para `alwayson_clientes_estrategicos`:
--   pending → processing → ready | not_found | error
-- O claim é CAS (`update ... where geo_status in (...)`), então dois workers em
-- paralelo não processam o mesmo CNPJ.
--
-- ⚠️ Nada disto vem do relatório de terceiro que originou a lista: endereço e
-- coordenada saem do CNPJ contra fonte pública. Ver docs/PENDENCIAS.md §5.
--
-- Projeto canônico: osukbalwykbqvoumddxz

alter table public.alwayson_clientes_estrategicos
  add column if not exists geo_status text not null default 'pending',
  add column if not exists geo_tentativas integer not null default 0,
  add column if not exists geo_motivo text,
  add column if not exists geo_verificado_em timestamptz;

alter table public.alwayson_clientes_estrategicos
  drop constraint if exists alwayson_clientes_estrategicos_geo_status_check;

alter table public.alwayson_clientes_estrategicos
  add constraint alwayson_clientes_estrategicos_geo_status_check
  check (geo_status in ('pending', 'processing', 'ready', 'not_found', 'error'));

comment on column public.alwayson_clientes_estrategicos.geo_status is
  'Fila de enriquecimento: pending → processing → ready|not_found|error. Consumida pela Edge Function enrich-estrategicos-geo.';
comment on column public.alwayson_clientes_estrategicos.geo_motivo is
  'Último motivo de falha/parcial devolvido pela fonte pública (brasil_api_404, sem_coordenada, ...).';
comment on column public.alwayson_clientes_estrategicos.geo_tentativas is
  'Quantas vezes o worker já tentou. Serve para distinguir "nunca tentado" de "tentado e a fonte não tem".';

-- Quem já tem coordenada não entra na fila.
update public.alwayson_clientes_estrategicos
   set geo_status = 'ready'
 where lat is not null
   and lng is not null
   and geo_status = 'pending';

-- Fila de trabalho: o worker pede sempre os `pending` mais antigos.
create index if not exists ix_alwayson_ce_geo_status
  on public.alwayson_clientes_estrategicos (geo_status, adicionado_em)
  where ativo;

-- A view usa `e.*` — sem recriar, as colunas novas não aparecem na leitura.
drop view if exists public.alwayson_clientes_estrategicos_v_lista;

create view public.alwayson_clientes_estrategicos_v_lista
with (security_invoker = true) as
select
  e.*,
  coalesce(
    c.nome_fantasia, c.razao_social,
    u.nome_fantasia, u.razao_social,
    i.nome_cliente, i.razao_social
  )                                                    as nome_exibicao,
  coalesce(e.cidade, c.cidade, u.municipio, i.cidade)  as cidade_exibicao,
  coalesce(e.estado, c.estado, u.uf, i.estado)         as estado_exibicao,
  coalesce(c.lat, u.latitude,  i.lat, e.lat)           as lat_exibicao,
  coalesce(c.lng, u.longitude, i.lng, e.lng)           as lng_exibicao,
  case
    when c.lat is not null then 'carteira'
    when u.latitude is not null then 'receita_cnefe'
    when i.lat is not null then 'insights'
    when e.lat is not null then coalesce(e.geo_fonte, 'proprio')
    else null
  end                                                  as geo_fonte_exibicao,
  (e.cliente_id is not null)                           as na_carteira,
  (u.cnpj is not null)                                 as no_universo_pdv
from public.alwayson_clientes_estrategicos e
left join public.alwayson_clientes_distribuidor c on c.id = e.cliente_id
left join public.alwayson_pdv_universo          u on u.cnpj = e.cnpj
left join public.alwayson_insights_clientes     i on i.cnpj_14 = e.cnpj;

comment on view public.alwayson_clientes_estrategicos_v_lista is
  'Lista estratégica com nome, praça e coordenada resolvidos por fonte pública na leitura — o nome do PDV não é armazenado.';

-- Painel da fila para a tela (uma linha, barata de ler).
create or replace view public.alwayson_clientes_estrategicos_v_geo_fila
with (security_invoker = true) as
select
  count(*)                                                             as total,
  count(*) filter (where v.lat_exibicao is not null)                   as com_coordenada,
  count(*) filter (where v.geo_status = 'pending')                     as pendentes,
  count(*) filter (where v.geo_status = 'processing')                  as em_processamento,
  count(*) filter (where v.geo_status = 'ready')                       as concluidos,
  count(*) filter (where v.geo_status = 'not_found')                   as sem_fonte,
  count(*) filter (where v.geo_status = 'error')                       as com_erro
from public.alwayson_clientes_estrategicos_v_lista v
where v.ativo;

comment on view public.alwayson_clientes_estrategicos_v_geo_fila is
  'Contadores da fila de geocodificação da lista estratégica — alimenta o cartão de progresso na tela.';

-- Quem já resolve coordenada por uma fonte **melhor** (carteira, universo PDV da
-- Receita, histórico Insights) sai da fila sem gastar chamada externa. Precisa
-- de vir depois da view — é ela que faz a cascata.
update public.alwayson_clientes_estrategicos e
   set geo_status = 'ready',
       geo_motivo = 'resolvido_por_fonte_melhor',
       geo_verificado_em = now()
  from public.alwayson_clientes_estrategicos_v_lista v
 where v.id = e.id
   and v.lat_exibicao is not null
   and e.geo_status = 'pending';
