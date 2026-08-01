# Roadmap — AlwaysOn Distribuidores

> Rascunho de visão de produto, não um plano de execução task-a-task (esses vivem em `docs/superpowers/plans/`). Serve para orientar prioridade — revisar e ajustar com o time antes de tratar qualquer fase como compromisso.

## Visão

Ferramenta para o executivo acompanhar a saúde dos distribuidores parceiros e fazer gestão de vendas para eles. A Fase 1 é uma plataforma de apoio à equipe de vendas e gestão — o restante evolui para monitoramento por agentes especializados, disparo de sugestões via WhatsApp, e soluções financeiras (Pix, campanhas comerciais, gamificação) integradas ao dia a dia comercial.

---

## Fase 1 — Plataforma de apoio à equipe de vendas e gestão (atual)

**Já entregue:** Dashboard, Performance (hierarquia de vendedores), Clientes + Cliente Detalhe, Estoque, Ingestão, Excelência (leitura), e o módulo mais maduro — **Insights** (sell-out territorial: ~49k NFs, redes de loja, per capita por cidade via IBGE, de-para de produto) com a Ponte Performance↔Insights (badge + comparativo sell-in × sell-out por CNPJ).

### O que depende de carga e o que depende de engenharia

> **Contexto de leitura:** em 2026-08-01 havia **um único upload, de um único distribuidor** (`FORNECEDOR 38496_PARATY.xls`, tipo `vendas`, ref. 2026-05). Os números abaixo são desse estágio inicial — não são conclusão estrutural. A carga em volume estava começando.

**1. Histórico — resolve-se sozinho com a carga.** Todo o sell-in está em um único mês (2026-05) simplesmente porque só um arquivo subiu. À medida que os meses entram, a série aparece. O que *é* estrutural aqui: a Performance é single-month por construção (`usePerfFilters`: *"Mês de análise (YYYY-MM) — início e fim são sempre iguais"*), então a tela de tendência é trabalho de engenharia que só faz sentido **depois** que houver meses no banco.

**2. Cobertura — depende de *qual* template sobe, não de quantos.** Hoje são 410 clientes cadastrados, 410 com faturamento, zero sem compra — porque o único arquivo enviado foi de **vendas**, e o parser cria o cliente como efeito colateral da nota. Existe um template separado de **`clientes`** (`cnpj, razao_social, nome_fantasia, cidade, estado, codigo_vendedor, nome_vendedor` → `alwayson_clientes_distribuidor`) feito exatamente para carregar a base independentemente de haver compra.

A implicação prática para a leva de uploads: **subir só arquivos de vendas dá histórico, mas nunca dá o denominador.** Sem o template de `clientes` carregando a base completa — inclusive quem não comprou —, cobertura/positivação continua 100% por construção por mais meses que entrem, e a pergunta "quantos clientes da base do vendedor ele *não* atendeu?" segue sem resposta.

Com a base carregada pelo template certo, **cobertura = clientes distintos que compraram ÷ carteira** sai direto, e o rollup vendedor → supervisor → gerente → distribuidor vem de graça: `alwayson_vendedores_distribuidor.supervisor_id` e a hierarquia já existem e estão populados.

### Frentes de trabalho

**a) Carga: base de clientes junto com as vendas (desbloqueia tudo)**
- Para cada distribuidor, subir o template **`clientes`** com a carteira completa — não só os arquivos de `vendas`. É o que cria o denominador.
- Ordem recomendada: `clientes` antes de `vendas`, para o cliente já nascer com o vendedor responsável correto em vez de ser criado como efeito colateral da nota.
- Tela de gestão de carteira no cadastro do distribuidor: ver e reatribuir clientes por vendedor (hoje não existe).

**b) Histórico (carga retroativa + carteira versionada)**
- Carregar os meses retroativos de sell-in — pré-requisito de dado.
- **Decisão de modelagem a tomar cedo:** a carteira muda no tempo (cliente troca de vendedor). Calcular a cobertura de janeiro com a carteira de hoje distorce o histórico. A saída barata é um **snapshot mensal** da carteira (`mês, cliente, vendedor, distribuidor`) gravado no fechamento — resolve sem lógica de vigência.
- Só depois de haver meses no banco a Performance ganha visão de série (evolução mês a mês, comparativo, variação) em vez do mês isolado.
- **Reimportação é segura hoje:** o mesmo arquivo foi processado duas vezes (1.004 registros cada) e a tabela ficou com exatamente 1.004 linhas — não duplicou. A dívida registrada em `docs/ingestao-normatizacao-divida-tecnica.md` (definir formalmente substituir × rejeitar) segue aberta, mas na prática o reprocesso substitui.

**c) Excelência: o schema já serve — falta dono do `realizado` e falta UI**
O modelo atual é melhor do que a percepção de "critério vago" sugere:
- `alwayson_excelencia_clientes` (distribuidor_id, cliente_id, ativo) **já é o cadastro de clientes foco** — está vazio e sem tela de carga.
- `alwayson_excelencia_criterios` (cliente_id, criterio, meta, realizado, atingido, **periodo**) já modela medição objetiva **com histórico**.
- `alwayson_excelencia_config` (criterio_nome, meta_valor, tipo_comparacao, ordem) define os critérios por distribuidor.
- `AdminExcelencia` hoje é **somente leitura** — não há como cadastrar nem critério nem cliente foco pela interface.

O que torna o critério vago não é o schema: é `realizado` não ter dono. Digitado à mão, vira subjetivo e ninguém mantém. A virada é classificar o critério por **natureza**:
- **Automático** — derivado do dado que já existe (comprou no período? tem N SKUs no mix? volume ≥ X? frequência de compra?). Calculado por view/job, zero digitação. É daqui que sai o *relatório de critérios*.
- **Verificação de campo** — material de PDV, visita, ruptura. Precisa de input, mas como checklist objetivo, não como nota.

Falta uma coluna de natureza em `excelencia_config` e uma de **`origem`** em `excelencia_clientes` (Scantech, indicação, whitespace territorial, decisão comercial) — para saber por que aquele cliente entrou na lupa.

**d) Whitespace: uma fonte de clientes foco que já está no banco**
Cruzando o universo territorial do Insights com a carteira do distribuidor: **8.438 CNPJs no Insights, 410 na carteira, apenas 153 em ambos** — ou seja, **8.285 clientes que a marca alcançou no território e que o distribuidor não atende hoje**. Isso é, literalmente, o backlog de recuperação/expansão que a tabela `alwayson_insights_acoes` (estados pendente/em_ação/resolvido/snooze/arquivado) já foi desenhada para gerir. É a terceira fonte de "cliente foco", ao lado da Scantech e da decisão comercial.

**e) Prioridade de execução do distribuidor**
A ponte entre *quem* (cliente foco) e *o quê* (critério): a fila do que o distribuidor precisa executar. `alwayson_insights_acoes` já é a engrenagem — hoje serve só ao Insights, por CNPJ + tenant; generalizar para a fila de execução do distribuidor evita construir um segundo sistema de backlog.

**f) Dívida que segue aberta**
- Carregar `metas_distribuidor`, `performance_periodo`, `estoque_distribuidor` (schema pronto, tabelas vazias).
- Histórico de CNPJ: o log de ajuste virou real (`alwayson_clientes_ajustes_cadastro`), mas ainda **não resolve** o faturamento/Insights do CNPJ antigo para o mesmo cliente — falta a view de resolução (Fase 3 do plano de 2026-04-27).
- Upload de sell-out (Insights) pela UI — hoje roda fora do app.
- Views `SECURITY DEFINER` do Insights no vermelho do linter; duas policies de escrita `ALL USING(true)` (de-para produto) a apertar para `current_user_is_admin()`.
- Cobertura de teste mínima (hoje zero) nas regras de negócio críticas (cobertura, metas/excelência, RLS de tenant).

## Fase 2 — Visão executiva

Camada acima do que já existe, pensada para quem gerencia a carteira de distribuidores (não o vendedor no campo):
- **Health score por distribuidor** — um número/semáforo combinando tendência de faturamento, aderência a metas, cobertura de Excelência e atividade recente, para priorizar onde o executivo olha primeiro.
- **Dashboard de portfólio** — visão consolidada de todos os distribuidores lado a lado (hoje o Dashboard já mostra ranking; falta comparação estruturada período-a-período e alertas de desvio).
- **Cadência de revisão** — resumo semanal/mensal pronto para reunião (o que já existe como dado disperso em Insights + Performance + Excelência, consolidado em uma narrativa: quem subiu, quem caiu, por quê).
- **Export executivo** (PDF/apresentação) — o app já usa `jspdf`/`jspdf-autotable` em algum ponto da Excelência; generalizar para um relatório de portfólio.

Depende de Fase 1 fechada (principalmente metas e performance_periodo com dado real — sem isso não há "aderência a meta" para compor o health score).

## Fase 3 — Agentes especializados + WhatsApp

- **Monitoramento automático por agente**: a tabela `alwayson_insights_acoes` (estados `pendente/em_acao/resolvido/snooze/arquivado`) já é a semente disso — hoje é preenchida manualmente pelo time; o próximo passo é um job que a alimenta sozinho a partir de regras (queda de recompra, cliente sumiu do sell-out, etc.).
- **Sugestão de compra**: modelo simples primeiro (regra de recência/frequência por SKU, tipo "não compra X há N dias, média histórica era Y") antes de qualquer coisa mais sofisticada.
- **Disparo via WhatsApp Business API**: mandar a sugestão para o vendedor ou direto para o cliente. Começar com aprovação humana no loop (vendedor confirma antes de enviar) — automação completa só depois de validar que as sugestões fazem sentido na prática.
- Multi-tenant já dá suporte a isso (`alwayson_tenants`/`alwayson_memberships` já isolam por organização) — o disparo por WhatsApp deve respeitar o mesmo isolamento.

Depende de Fase 1 (dado de sell-out/sell-in consistente) e se apoia em Fase 2 para priorizar quem recebe atenção do agente primeiro.

## Fase 4 — Soluções financeiras e engajamento

- **Pagamento via Pix** integrado ao fluxo comercial (ex.: liquidação de campanhas, incentivo por meta batida).
- **Campanhas comerciais fomentadas** — ligar orçamento de campanha a metas/Excelência já existentes, não um sistema paralelo.
- **Gamificação** — ranking e recompensas por adesão ao plano de Excelência e cumprimento de metas; a infraestrutura de critérios/pontuação da Excelência já dá a base de dados, falta a camada de pontos/prêmios.

Fase mais distante e a que mais depende de decisão de negócio (parceiro financeiro, compliance de pagamento) — não bloqueia as fases anteriores, mas também não deve competir por atenção de engenharia antes delas estarem maduras.

---

## Como usar este documento

Cada fase, quando for priorizada de verdade, ganha um plano de execução próprio em `docs/superpowers/plans/` (goal, arquitetura, tarefas checkbox) — este arquivo é só o mapa de onde cada coisa entra na sequência. Atualize aqui quando uma fase mudar de "roadmap" para "em andamento" ou "entregue", para não repetir o que aconteceu com o plano de 2026-04-27 (que ficou desatualizado depois que Insights e a Ponte foram além do que ele previa).
