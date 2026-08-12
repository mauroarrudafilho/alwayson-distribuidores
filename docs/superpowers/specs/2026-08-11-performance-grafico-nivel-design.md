# Gráfico macro por nível na Performance

> Design validado em 2026-08-11, depois de uso real da Performance por
> evolução (etapas 1 e 2, já em produção). Constrói sobre
> `docs/superpowers/specs/2026-08-11-performance-evolucao-design.md`.

## Problema

Gerência, Supervisão e Vendas ganharam, na etapa 2, uma coluna "Evolução" por
linha (variação % + minissérie) — mas não têm o equivalente do gráfico grande
que Distribuidor já tem. Para comparar como um punhado de gerentes, supervisores
ou vendedores evoluíram entre si ao longo do tempo, hoje só dá para olhar
minissérie por minissérie, uma linha de tabela de cada vez.

## Dois bugs reportados no mesmo uso, corrigidos antes deste spec

Não fazem parte deste design — já foram para `main` em `1b0eb67`:

1. **Cor da minissérie divergia da variação %.** `Minisserie.tsx` coloria
   comparando só os dois últimos pontos locais, um sinal diferente do
   percentual ao lado (Heraldo Menezes: +71,2% com sparkline vermelha). A cor
   passou a vir de fora, do mesmo sinal do percentual.
2. **Badge "Novo" marcava toda a carteira.** `isClienteNovo` usava
   `criado_em` (data de inserção no banco), recente para todo cliente numa
   carga histórica em massa. Passou a ser `nfsTotal === 1` — só uma compra na
   vida inteira do cliente. Verificado contra o banco: a proporção real caiu
   de 100% para 23,3%.

## Decisões

1. **Componente novo, `EvolucaoGraficoNivel.tsx`, não extensão do
   `EvolucaoGrafico` existente.** Fonte de dado diferente (`useSerieHierarquia`,
   grão de hierarquia, contra `useFaturamentoMensal`, grão de
   distribuidor+fornecedor), forma diferente (N entidades dinâmicas contra duas
   linhas fixas), sem marcador de meta. Misturar os dois modos no mesmo arquivo
   arriscaria regredir o gráfico do Distribuidor, já revisado e em produção.
2. **Top 5 entidades por faturamento do período atual, resto agregado em
   "Outros".** Só aparece quando há mais de 5 entidades no nível — em Gerência
   (4 gerentes hoje) provavelmente nunca.
3. **Cada entidade mostra as duas linhas — atual e comparação —, não só a
   atual.** Responde "quem melhorou", não só "quem é maior". Custo: com 5
   entidades + Outros, são 12 linhas simultâneas — no limite do legível.
4. **Cor por entidade, traço por período.** `INSIGHTS_CHART_COLORS[0..4]`
   para as 5 top, `[5]` para "Outros" — determinístico entre re-renders. Sólido
   = atual, tracejado = anterior, mesmo vocabulário do gráfico do Distribuidor.
   A legenda mostra 6 entradas (uma por cor), não 12.
5. **Clique em linha ou legenda aplica `drillDown`** com os mesmos parâmetros
   que a linha da tabela já usa nesse tab. "Outros" não é clicável — não há
   entidade única para navegar.
6. **Cliente fica de fora.** Decisão do usuário — não faz sentido no nível de
   CNPJ individual.

## Dados

Sem fetch novo. Cada tab já chama `useSerieHierarquia(distribuidorId, nivel,
janela)` duas vezes (janela atual e comparação) para alimentar a coluna
Evolução da tabela — o componente recebe essas mesmas duas `Map<string,
SerieEntidade>` como props e faz o ranking/agregação em memória:

1. Ordena as chaves do Map da janela atual por `.total`, desc.
2. Top 5 viram linhas próprias; o resto soma mês a mês (nas duas séries, atual
   e anterior) numa entrada sintética "Outros".
3. Nomes vêm de `hierarchy.gerentes` / `.supervisores` / `.vendedoresOnly` —
   a mesma fonte que a tabela já usa. Nunca UUID.

## Onde entra na tela

Entre o `KPIGrid` existente e a tabela, em `GerenciaTab.tsx`, `SupervisaoTab.tsx`
e `VendasTab.tsx` — mesma posição que `EvolucaoGrafico` ocupa em
`DistribuidorTab.tsx`.

## Filtro de Vendas

Fora do gráfico, mas no mesmo pacote de trabalho por pedido do usuário:
`VendasTab.tsx` remove o dropdown "Gerente" da barra de filtros, mantendo só
"Supervisor". `gerenteId` continua existindo em `filters` — chega pelo caminho
do drill-down (Gerência → Supervisão → Vendas) — e continua sendo passado ao
`drillDown` no clique da linha; só o atalho de trocar de gerente sem sair da
aba desaparece. Remove também o cálculo `gerentesForFilter`/`showGerenteFilter`
que ficam sem uso.

## Fora de escopo

- Gráfico em Cliente.
- Configurar N (fixo em 5).
- Marcador de meta no gráfico por nível — meta é conceito de distribuidor, não
  agrega de forma óbvia por gerente/supervisor/vendedor.
- Tooltip com detalhamento de quem está dentro de "Outros" além da contagem.

## Critérios de sucesso

1. Em Gerência, com 4 gerentes, "Outros" nunca aparece.
2. Em Vendas, sob um supervisor com mais de 5 vendedores, "Outros" aparece e
   soma corretamente os excedentes.
3. Clicar numa linha ou legenda de uma entidade (não "Outros") navega para o
   próximo nível já filtrado por ela — mesmo destino que clicar a linha da
   tabela.
4. A cor de uma entidade não muda entre re-renders (troca de janela, por
   exemplo) enquanto ela continuar entre as top 5.
5. Vendas mostra só o filtro Supervisor; Gerência continua acessível via
   breadcrumb, não via dropdown nesta aba.
