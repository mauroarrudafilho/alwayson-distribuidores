-- 065 — coordenada própria na lista estratégica + cruzamento com o Explorar.
--
-- Só 10 dos 1.327 tinham coordenada por fonte pública (universo PDV do piloto
-- Petrolina). O resto não está em nenhuma tabela com geo, então não há de onde
-- resolver na leitura: a coordenada precisa de casa própria.
--
-- ⚠️ Continua sem violar a restrição do relatório de terceiro: a coordenada vem
-- do endereço da Receita Federal + geocoder, não da planilha. Ver PENDENCIAS §5.
--
-- `geo_fonte` regista a procedência para dar para reprocessar só o que ficou em
-- fonte fraca (`cidade_centroide` = aproximação da cidade, não do PDV) sem
-- refazer o que já está bom. É lista fechada: rotular fora dela rebenta o
-- INSERT — o script `estrategicos:enrich-geo` valida antes de gravar.
--
-- Projeto canônico: osukbalwykbqvoumddxz

alter table public.alwayson_clientes_estrategicos
  add column if not exists lat  double precision,
  add column if not exists lng  double precision,
  add column if not exists geo_fonte text,
  add column if not exists geo_atualizado_em timestamptz;

alter table public.alwayson_clientes_estrategicos
  drop constraint if exists alwayson_clientes_estrategicos_geo_fonte_check;

alter table public.alwayson_clientes_estrategicos
  add constraint alwayson_clientes_estrategicos_geo_fonte_check
  check (geo_fonte is null or geo_fonte in (
    'receita_cnefe', 'brasilapi', 'nominatim', 'insights', 'cidade_centroide', 'manual'
  ));

comment on column public.alwayson_clientes_estrategicos.lat is
  'Coordenada própria, preenchida por geocoder a partir do endereço público (Receita). Só usada quando nenhuma fonte melhor tem o CNPJ.';
comment on column public.alwayson_clientes_estrategicos.geo_fonte is
  'De onde veio a coordenada. cidade_centroide = aproximação pela cidade, não o PDV — não usar para roteirização.';

-- A view recria com geo resolvido pela mesma cascata de fonte pública do nome.
-- ⚠️ Ela usa `e.*`: dropar antes de mexer na tabela, senão 2BP01.
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

-- Lookup por CNPJ ativo: é o que o Explorar usa para carimbar cada PDV.
create index if not exists ix_alwayson_ce_cnpj_ativo
  on public.alwayson_clientes_estrategicos (cnpj)
  where ativo;
