# Roadmap — AlwaysOn Distribuidores

> Rascunho de visão de produto, não um plano de execução task-a-task (esses vivem em `docs/superpowers/plans/`). Serve para orientar prioridade — revisar e ajustar com o time antes de tratar qualquer fase como compromisso.

## Visão

Ferramenta para o executivo acompanhar a saúde dos distribuidores parceiros e fazer gestão de vendas para eles. A Fase 1 é uma plataforma de apoio à equipe de vendas e gestão — o restante evolui para monitoramento por agentes especializados, disparo de sugestões via WhatsApp, e soluções financeiras (Pix, campanhas comerciais, gamificação) integradas ao dia a dia comercial.

---

## Fase 1 — Plataforma de apoio à equipe de vendas e gestão (atual)

**Já entregue:** Dashboard, Performance (hierarquia de vendedores), Clientes + Cliente Detalhe, Estoque, Ingestão, Excelência (critérios de plano), e o módulo mais maduro — **Insights** (sell-out territorial: ~49k NFs, redes de loja, per capita por cidade via IBGE, de-para de produto) com a Ponte Performance↔Insights (badge + comparativo sell-in × sell-out por CNPJ).

**Para fechar a Fase 1 antes de investir nas próximas:**
- Carregar dado real em `metas_distribuidor`, `performance_periodo`, `estoque_distribuidor` e no módulo Excelência — hoje o schema existe, a tela existe, mas as tabelas estão vazias.
- Histórico de CNPJ de verdade (vincular CNPJ antigo → cliente atual, com auditoria) — hoje é só uma tela; virou dado real nesta sessão (`alwayson_clientes_ajustes_cadastro`), mas ainda não resolve automaticamente o faturamento/Insights do CNPJ antigo para o mesmo cliente (o plano original em `docs/superpowers/plans/2026-04-27-insights-connection-and-roadmap.md`, Fase 3, cobre a view de resolução — ainda não implementada).
- Upload de sell-out (Insights) direto pela UI — hoje esse pipeline roda fora do app (processo externo/manual); dá pra fechar o loop com uma tela de upload no Admin, como o plano original já especificava.
- Tirar as views `SECURITY DEFINER` do Insights do vermelho do linter de segurança, e apertar as duas policies de escrita `ALL USING(true)` (de-para produto) para `current_user_is_admin()` — mesmo padrão já usado no restante do app.
- Cobertura de teste mínima (hoje zero) nos hooks e regras de negócio mais críticos (cálculo de metas/excelência, RLS de tenant).

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
