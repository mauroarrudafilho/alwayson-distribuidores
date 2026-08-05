-- 063 — a origem de terceiro sai do dado e do vocabulário.
--
-- Restrição contratual: o relatório de mercado que originou a lista estratégica
-- é de um **provedor externo**. Nem as métricas dele (share, volume por marca,
-- gap, oportunidade) nem o **nome do provedor** podem aparecer na plataforma.
--
-- A migration `052` tinha deixado o provedor como valor do CHECK de `origem` —
-- ou seja, disponível como classificador na interface. Isso também viola a
-- restrição: não basta limpar o texto livre, o vocabulário tem de perder a
-- opção. Uma lista vinda de relatório de terceiro entra como `potencial`.
--
-- O `motivo` passa a descrever **por que** o PDV importa, não **de onde** veio.
--
-- Projeto canônico: osukbalwykbqvoumddxz

update public.alwayson_clientes_estrategicos
   set motivo = 'PDV de alto volume na praça — alvo prioritário de cobertura territorial (base 1º semestre/2026).'
 where motivo ilike '%scantech%' or motivo ilike '%scanntech%';

update public.alwayson_clientes_estrategicos
   set origem = 'potencial'
 where origem = 'scantech';

update public.alwayson_clientes_estrategicos
   set observacao = null
 where observacao ilike '%scantech%' or observacao ilike '%scanntech%';

alter table public.alwayson_clientes_estrategicos
  drop constraint if exists alwayson_clientes_estrategicos_origem_check;

alter table public.alwayson_clientes_estrategicos
  add constraint alwayson_clientes_estrategicos_origem_check
  check (origem is null or origem in (
    'indicacao', 'decisao_comercial', 'rede', 'potencial', 'outro'
  ));

comment on column public.alwayson_clientes_estrategicos.origem is
  'De onde veio a indicação: indicacao | decisao_comercial | rede | potencial | outro. Provedor externo de dado de mercado não entra aqui.';
