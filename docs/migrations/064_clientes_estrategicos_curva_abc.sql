-- 064 — a prioridade passa a ser curva ABC por estado; motivo e origem saem.
--
-- Decisão de produto: numa lista carregada em massa, `motivo` e `origem` eram
-- o mesmo texto repetido em 1.327 linhas — ruído, não curadoria. O que separa
-- de facto os clientes é o **tamanho relativo** de cada um. Fica só
-- `prioridade`, agora com significado:
--
--   alta = classe A     media = classe B     baixa = classe C
--
-- ─── Como a curva foi calculada ─────────────────────────────────────────────
--
-- **Dentro de cada UF**, não no total. Essa é a parte que importa: no total, a
-- Bahia (354 PDVs) engoliria Sergipe (28) e estados pequenos ficariam sem
-- nenhum cliente de alta. Por UF, cada praça tem os seus próprios A.
--
-- Cortes por volume acumulado da UF:  A até 50%  ·  B até 80%  ·  C o resto.
--
-- ⚠️ **Armadilha do ABC acumulado.** O item que *cruza* o limiar tem de ficar
-- na classe melhor. Classificando pelo acumulado *depois* de somar o item, o
-- maior PDV de SE — que sozinho é 58% do estado — caía em B, e SE terminava
-- com **zero** clientes A. A classificação usa o acumulado *antes* do item,
-- o que garante que o maior PDV de cada estado é sempre A.
--
-- Distribuição resultante: 303 A · 468 B · 556 C.
--
-- ⚠️ O volume em si **não entra na plataforma** (restrição contratual — ver
-- docs/PENDENCIAS.md §5). Só a classe resultante é gravada. Recalcular a curva
-- exige a planilha de origem outra vez; não dá para derivar do que está aqui.
--
-- `observacao` continua, para nota livre de quem curar a lista à mão.
--
-- ⚠️ **Ordem obrigatória abaixo:** a view usa `e.*`, então depende de TODAS as
-- colunas da tabela. Dropar a coluna com a view de pé devolve `2BP01`. Derruba
-- a view primeiro, mexe na tabela, recria a view.
--
-- Projeto canônico: osukbalwykbqvoumddxz

begin;

drop view if exists public.alwayson_clientes_estrategicos_v_lista;

alter table public.alwayson_clientes_estrategicos
  drop constraint if exists alwayson_clientes_estrategicos_origem_check;

alter table public.alwayson_clientes_estrategicos
  drop column if exists motivo,
  drop column if exists origem;

comment on column public.alwayson_clientes_estrategicos.prioridade is
  'Curva ABC por UF: alta=A (até 50% do volume do estado), media=B (até 80%), baixa=C. Derivada na carga; o volume não é armazenado.';

comment on column public.alwayson_clientes_estrategicos.observacao is
  'Nota livre de quem cura a lista. Único campo de texto que sobrou — motivo e origem saíram na migration 064.';

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
  (e.cliente_id is not null)                           as na_carteira,
  (u.cnpj is not null)                                 as no_universo_pdv
from public.alwayson_clientes_estrategicos e
left join public.alwayson_clientes_distribuidor c on c.id = e.cliente_id
left join public.alwayson_pdv_universo          u on u.cnpj = e.cnpj
left join public.alwayson_insights_clientes     i on i.cnpj_14 = e.cnpj;

comment on view public.alwayson_clientes_estrategicos_v_lista is
  'Lista estratégica com nome e praça resolvidos por fonte pública na leitura — o nome do PDV não é armazenado.';

commit;

-- A atribuição das 1.327 classes foi feita por UPDATE em bloco a partir do
-- cálculo local (três listas de CNPJ). Não fica aqui: são 20 KB de CNPJ e o
-- resultado é reproduzível a partir da planilha de origem com a regra acima.
