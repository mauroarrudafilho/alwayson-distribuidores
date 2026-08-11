# Performance: da fotografia mensal à evolução

> Design validado em 2026-08-11. Substitui o recorte single-month da tela
> Performance por acompanhamento de série, mantendo o drill-down hierárquico.

## Problema

A Performance responde bem "como foi este mês" e é cega a tudo o que dependa de
tempo. Com 20 meses de sell-in no banco, as perguntas que ficam sem resposta são
justamente as que interessam ao acompanhamento: o distribuidor está crescendo,
quais vendedores mudaram de patamar, se a carteira está expandindo ou apenas
comprando mais.

O Dashboard continua sendo o bate-olho do mês vigente. A Performance passa a ser
a tela de evolução.

## O dado disponível (verificado em 2026-08-11)

| | |
|---|---|
| Série de faturamento | jan/2025 → ago/2026, 20 meses, 11.251 NFs, 24.389 itens |
| Sobreposição ano a ano | jan–jul existe em 2025 **e** 2026 |
| Vendedores por mês | 52–58, estável |
| Metas | apenas 2026-05, 2026-06 e 2026-08 — **julho falta** |
| Mês corrente | ago/2026 parcial (48 NFs no dia 11) |

Duas propriedades do dado moldam o desenho:

**Sazonalidade forte.** Março dispara (R$ 1,78M em 2025, R$ 2,11M em 2026) e
setembro afunda (R$ 299k). Qualquer comparação contra o mês anterior produz
alarme falso recorrente: abril cai ~70% contra março todo ano. A comparação
honesta é contra o mesmo mês do ano anterior.

**O crescimento não vem de mais clientes.** jan–jul de 2026 contra 2025:

| | 2025 | 2026 | |
|---|---|---|---|
| Faturamento | R$ 5.290.367 | R$ 6.316.519 | +19,4% |
| Notas | 3.937 | 4.444 | +12,9% |
| Clientes distintos | 1.541 | 1.560 | +1,2% |
| Ticket médio por nota | R$ 1.344 | R$ 1.421 | +5,8% |
| Faturamento por cliente | R$ 3.432 | R$ 4.049 | +18,0% |

A base está parada; o crescimento é mais notas por cliente (+11,5%) e ticket
maior (+5,8%). Esta é a leitura que a tela precisa entregar de imediato.

## Decisões

1. **O eixo da tela é tendência**, não detecção de movimento nem ciclo de vida da
   carteira. Essas duas continuam sendo telas possíveis no futuro; não são esta.
2. **O drill-down hierárquico existente é preservado** e ganha o eixo do tempo.
   Abas, filtros por URL e navegação continuam iguais.
3. **A comparação padrão é contra o mesmo período do ano anterior.** Contra o
   período imediatamente anterior é opção, não default.
4. **O Dashboard não muda nesta rodada.**

## Arquitetura de dados

### Por que uma view agregada

`loadFaturamentoSales` já pagina corretamente (sem risco do truncamento em 1000
linhas que atingiu o Insights), mas `fetchSkusByFaturamento` fatia os IDs de 200
em 200 e faz as idas ao Postgres **em série**. Num mês são ~500 NFs e 3 idas;
em 12 meses são 7.314 NFs e ~37 idas sequenciais. A tela sairia de instantânea
para vários segundos, degradando a cada mês carregado.

A série mensal não precisa de nota a nota: 20 meses × ~54 vendedores ≈ 1.100
linhas contra 24 mil.

### A view

```
alwayson_faturamento_v_mensal
  grão: (distribuidor_id, fornecedor_tenant_id, vendedor_id, mes)
  → faturamento, nfs, clientes_positivados, skus_distintos
```

Três exigências não negociáveis:

- **`GROUPING SETS` (ou uma segunda view no grão do distribuidor).**
  `clientes_positivados` e `skus_distintos` **não somam**: o mesmo cliente
  comprando de dois vendedores conta uma vez no distribuidor e duas se somar as
  linhas. Faturamento e NFs somam; os distintos não. O total do distribuidor tem
  de ser calculado, nunca derivado da soma dos vendedores.
- **`security_invoker`**, como a `alwayson_metas_v_acompanhamento`, para que o
  escopo das migrations `048`/`049` valha na leitura.
- **Os dois eixos** (`distribuidor_id` + `fornecedor_tenant_id`). Sem o carimbo
  de fornecedor a linha fica invisível a não-admin pela falha fechada do
  `NULL IN (...)`.

### O que não muda

O drill-down de um mês específico continua em `loadFaturamentoSales`, sem
alteração — para um mês ele já é rápido e já está validado em produção.

## A tela

### Filtros

`MÊS` dá lugar a:

- **`JANELA`** — 12 meses por padrão; opções 6 / 12 / 24 / toda a série.
- **`COMPARAR COM`** — mesmo período do ano anterior (padrão) / período anterior
  / nenhum.

`DISTRIBUIDOR` e `MÉTRICA` (R$ / Un.) permanecem como estão.

### Faixa de topo

Os quatro KPIs deixam de ser valores de um mês e passam a ser leituras do
período com variação: faturamento, notas, clientes distintos e **ticket médio
por nota**.

Os quatro juntos contam a história de profundidade vs expansão, ainda que com um
passo de dedução: faturamento sobe 19,4%, a base de clientes fica parada em
+1,2% e o ticket sobe pouco (+5,8%) — logo o que cresceu foi a **frequência**,
mais notas por cliente. `Faturamento por cliente` mostraria isso direto (+18,0%),
mas é métrica menos familiar; a escolha foi por legibilidade.

### Gráfico principal

Série mensal com a mesma janela do ano anterior sobreposta. É o que torna a
sazonalidade legível em vez de alarmante: o pico de março e o vale de setembro
aparecem repetindo, e a distância entre as linhas é o crescimento real.

### Tabelas hierárquicas

Cada linha (gerente / supervisor / vendedor / cliente) ganha três colunas: valor
no período, variação contra o ano anterior e uma minissérie de 12 meses.
Ordenar por variação responde "quem puxou o crescimento" e "quem está caindo
contra o próprio ano passado".

### Metas

Saem dos KPIs. Com dado em apenas 3 meses e um buraco em julho, viram marcador
pontual sobre a série onde existem. **O buraco aparece como ausência, nunca como
zero.** `Meta vs Realizado` como card pertence ao Dashboard.

### Ausência de contraparte

A variação YoY só existe para meses com par. Para jan/2025 não há contra o quê
comparar: a coluna fica **vazia**, não zerada e não estimada.

## Fora de escopo

- Alterações no Dashboard.
- Ciclo de vida da carteira (novos / recorrentes / perdidos) — depende do
  template `clientes` para ter denominador honesto; ver `PENDENCIAS.md` §2.
- Ranking de movimento como tela própria.
- Recalcular ou preencher a meta faltante de julho/2026.

## Riscos

| Risco | Mitigação |
|---|---|
| Somar `clientes_positivados` entre vendedores infla o total | `GROUPING SETS`; total do distribuidor nunca derivado da soma |
| View sem `security_invoker` fura o escopo por tenant | Espelhar `alwayson_metas_v_acompanhamento` |
| Linha sem `fornecedor_tenant_id` some para não-admin | Os dois eixos na view; trigger da `050` já cobre a origem |
| Mês corrente parcial lido como queda | Marcar o mês em curso como incompleto na série |
| Janela de 24 meses reintroduzir lentidão | A série vem da view; o row-level só carrega no drill-down de um mês |

## Critérios de sucesso

1. A tela abre em 12 meses e mostra +19,4% de faturamento contra +1,2% de
   clientes e +5,8% de ticket — dá para concluir que o crescimento veio de
   frequência, sem sair da faixa de topo.
2. Ordenar a tabela de vendedores por variação identifica quem sustenta o
   crescimento.
3. Abril e setembro não produzem alarme: a linha do ano anterior mostra o mesmo
   vale.
4. O drill-down por URL continua funcionando como hoje.
5. O total de positivados do distribuidor não é a soma dos vendedores.
