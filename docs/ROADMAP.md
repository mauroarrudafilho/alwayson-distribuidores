# Roadmap — AlwaysOn Distribuidores

> Rascunho de visão de produto, não um plano de execução task-a-task (esses vivem em `docs/superpowers/plans/`). Serve para orientar prioridade — revisar e ajustar com o time antes de tratar qualquer fase como compromisso.

## Visão

Ferramenta para o executivo acompanhar a saúde dos distribuidores parceiros e fazer gestão de vendas para eles. A Fase 1 é uma plataforma de apoio à equipe de vendas e gestão — o restante evolui para monitoramento por agentes especializados, disparo de sugestões via WhatsApp, e soluções financeiras (Pix, campanhas comerciais, gamificação) integradas ao dia a dia comercial.

---

## Fase 1 — Plataforma de apoio à equipe de vendas e gestão (atual)

**Já entregue:** Dashboard, Performance (hierarquia de vendedores), Clientes + Cliente Detalhe, Estoque, Ingestão, Excelência (leitura), e o módulo mais maduro — **Insights** (sell-out territorial: ~49k NFs, redes de loja, per capita por cidade via IBGE, de-para de produto) com a Ponte Performance↔Insights (badge + comparativo sell-in × sell-out por CNPJ).

### O bloqueio de fundo: falta o denominador e falta o eixo do tempo

As lacunas sentidas na Performance, na Excelência e no cadastro do distribuidor não são quatro problemas — são dois, e ambos são de **dado**, não de tela. Medido no banco em 2026-08-01:

**1. A carteira não é uma carteira.** São 410 clientes cadastrados, 410 com faturamento, **zero sem nenhuma compra**. O cadastro de cliente hoje é um subproduto da ingestão de faturamento: um cliente só existe no banco porque emitiu nota. Consequência direta — cobertura/positivação dá **100% por construção** para todos os 52 vendedores, e a pergunta mais importante da gestão de vendas ("quantos clientes da base do vendedor ele *não* atendeu neste mês?") é impossível de responder, porque os não-atendidos não existem como registro.

**2. Não existe histórico.** Todo o sell-in está concentrado em **um único mês (2026-05)**. E a Performance é single-month por construção (`usePerfFilters`: *"Mês de análise (YYYY-MM) — início e fim são sempre iguais"*). Ou seja: nenhuma tela de tendência resolve isso enquanto não houver carga retroativa — não há série para plotar.

Enquanto esses dois pontos não forem resolvidos, health score, aderência a meta e qualquer leitura de evolução (Fase 2) ficam sem base. **São o gargalo real da Fase 1.**

### Frentes de trabalho

**a) Carteira como cadastro próprio (desbloqueia tudo)**
- Template/ingestão de carteira independente do faturamento: cliente + vendedor responsável, exista compra ou não. É o que cria o denominador.
- A partir dele: **cobertura = clientes distintos que compraram ÷ carteira**, no mês e na série. O rollup vendedor → supervisor → gerente → distribuidor sai de graça, porque `alwayson_vendedores_distribuidor.supervisor_id` e a hierarquia já existem e estão populadas.
- Tela de gestão de carteira no cadastro do distribuidor: ver e reatribuir clientes por vendedor.

**b) Histórico (sell-in retroativo + carteira versionada)**
- Carregar 12–24 meses de sell-in — pré-requisito de dado, não de engenharia.
- **Decisão de modelagem a tomar antes da carga:** a carteira muda no tempo (cliente troca de vendedor). Calcular a cobertura de janeiro com a carteira de hoje distorce o histórico. A saída barata é um **snapshot mensal** da carteira (`mês, cliente, vendedor, distribuidor`) gravado no fechamento — resolve sem precisar de lógica de vigência.
- Só depois disso a Performance ganha visão de série (evolução mês a mês, comparativo, variação) em vez do mês isolado.

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
