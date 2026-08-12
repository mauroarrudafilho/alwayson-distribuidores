# Plataforma de Gestão do Distribuidor — Roadmap consolidado

**Data:** 2026-08-12
**Status:** Aprovação de escopo pendente
**Origem:** sessão de brainstorming (Início, metas de positivação, carteira, estoque ideal, comunicação, ingestão automatizada, Explorar em escala)

---

## 1. Visão

Transformar a plataforma de "relatório dos números do distribuidor" em **instrumento de gestão do KAM**: avaliar resultado, direcionar o distribuidor a trabalhar nos parâmetros definidos pelo fornecedor, e fechar o ciclo avaliar → agir → cobrar. Cada funcionalidade abaixo existe para servir a esse ciclo.

## 2. Estado verificado do dado (2026-08-12)

Verificado direto no banco — **corrige o snapshot do CLAUDE.md** (que dizia "1 mês de faturamento"):

- **Paraty**: 20 meses contínuos (jan/2025 → ago/2026 parcial), 24 uploads (todos `vendas`), 11.251 notas, 24.389 itens, ~R$ 15,1M acumulado. Positivados/mês entre 349 e 771.
- **Carteira**: 2.169 clientes, todos com `vendedor_id` preenchido (herdado da nota, não curado). Hierarquia completa: 79 vendedores → 11 supervisores → 4 gerentes.
- **Estoque**: schema pronto (`dias_cobertura`, `estoque_minimo_calculado`, `sugestao_pedido`), **zero uploads**.
- **Template `clientes` nunca carregado** → cobertura/positivação seguem 100% por construção quando o denominador é "carteira cadastrada".

Implicação: análises de tendência, churn e pacing estão **desbloqueadas** (há história suficiente). Positivação já é mensurável com denominador "base histórica" (quem já comprou).

## 3. Pacotes de escopo

### Pacote A — "Início" (ex-Dashboard) + reorganização da Sidebar

**Objetivo:** o KAM abre o sistema e vê o que precisa saber e fazer hoje, não uma foto estática.

Blocos do Início, em ordem:

1. **Ritmo do mês (pacing)** — realizado vs meta (via `alwayson_metas_v_acompanhamento`), projeção de fechamento por dia útil ("no ritmo atual fecha em 87%; faltam R$ X/dia útil").
2. **Fila de ação** — itens clicáveis que levam à tela que resolve: relatórios pendentes/atrasados, SKUs não mapeados (fila existente), distribuidores sem dados recentes, estoque crítico (quando popular), alertas do motor (Pacote C).
3. **Destaques automáticos** — 3-4 frases: maiores altas/quedas por distribuidor e por produto no período (base `useSerieEntidade`/`useSerieProduto`).
4. **Saúde do dado** — por distribuidor, quais uploads do mês entraram (vendas ✓ / clientes ✗ / estoque ✗) + SLA de chegada (Pacote G).

Sidebar reorganizada:

| Grupo | Itens |
|---|---|
| (topo, sem grupo) | **Início** |
| **Gestão** | Performance, Metas, Clientes Estratégicos, Clientes |
| **Mercado** | Insights, Explorar |
| **Operação** | Estoque, Ingestão |

Mudança conceitual: Clientes sai de "operação" (consulta de cliente é gestão); Insights+Explorar viram o par "onde crescer".

**Sem migration.** Rename de rota/label + novos blocos consumindo hooks existentes + 1 hook novo de pacing.

### Pacote B — Metas de positivação

**Objetivo:** acompanhar positivação como meta formal, por distribuidor e por vendedor.

- Novo `tipo` de meta: `positivacao` (alvo em **nº de clientes positivados no mês** — mais cobrável que %).
- Realizado derivado na view `alwayson_metas_v_acompanhamento` (mesmo padrão da meta de faturamento — **nunca coluna gravada**): `count(distinct cliente_id)` com nota no período.
- **Denominador em duas fases, rotulado na UI:** hoje "base histórica" (quem já comprou); quando o template `clientes` subir, "carteira cadastrada". Nunca comparar fases sem rótulo.
- Extensão natural: positivação **de estratégicos** (dos CNPJs da lista na carteira do distribuidor, quantos compraram no mês).
- Respeitar armadilhas conhecidas da view: índices parciais → `ON CONFLICT` com predicado; hook usa select→update/insert.

**Migration:** adicionar valor ao enum de tipo de meta + extensão da view.

### Pacote C — Parâmetros-alvo, motor de alertas e plano de ação

**Objetivo:** a peça central do "fazer o distribuidor trabalhar nos nossos parâmetros".

1. **Parâmetros-alvo por distribuidor** (tabela nova, ex. `alwayson_distribuidor_parametros`): cobertura alvo, positivação mínima de estratégicos, mix mínimo de SKUs por cliente, share por linha de produto, meta de carteira por vendedor (Pacote D). Telas passam a mostrar realizado vs parâmetro; Início mostra semáforo consolidado.
2. **Motor de alertas** (regra → evento → canal): cliente estratégico sem compra há N dias, queda de faturamento > X%, meta abaixo do ritmo, cobertura caindo, arquivo não chegou (Pacote G), estoque abaixo do ideal (Pacote E). Central de alertas in-app; canais e-mail/WhatsApp vêm do Pacote F — **é o mesmo sistema, escopar junto**.
3. **Plano de ação** (tabela nova, ex. `alwayson_acoes`): ação vinculada a distribuidor/cliente/meta, com responsável, prazo, status. Nova entrada de sidebar no grupo Gestão (ou bloco do Início). Fecha o ciclo avaliar → agir → cobrar.
4. **One-pager mensal exportável (PDF)** por distribuidor para a reunião KAM ↔ distribuidor: faturamento, metas, cobertura, estratégicos, top quedas, ações pendentes. Baixo custo, alto valor percebido.

**Migrations:** parâmetros, alertas (regras + eventos), ações. RLS seguindo o padrão vigente (escrita operacional via recorte do KAM).

### Pacote D — Carteira de atendimento (vendedor/supervisor/gerência)

**Objetivo:** carteira como cadastro intencional, não efeito colateral da nota.

- **Dois modelos coexistem**, escolhidos por distribuidor via campo `modelo_carteira` na config:
  - **Carteira efetiva (nominal):** `clientes_distribuidor.vendedor_id` vira fonte autoritativa via template `clientes` (ou tela de gestão de carteira). Regra nova: **a ingestão de vendas deixa de sobrescrever o vínculo quando houver cadastro explícito** (flag de origem do vínculo).
  - **Número puro:** parâmetro por vendedor ("atender 120 PDVs") comparado a carteira real e positivados — implementado via Pacote C.
- Supervisor/gerência herdam por agregação da hierarquia já existente em `alwayson_vendedores_distribuidor`.
- Dependência: metas de positivação **por vendedor** (Pacote B) precisam da carteira curada para denominador honesto.

**Migration:** flag de origem do vínculo + `modelo_carteira`.

### Pacote E — Estoque ideal por item

**Objetivo:** a aba Estoque deixa de ser fotografia e vira recomendação de compra.

- **Cadastro por item** (tabela nova, ex. `alwayson_estoque_parametros_item`): formato de compra (frequência de pedido: semanal/quinzenal/mensal), lead time (dias), cobertura ideal (dias). Por distribuidor+SKU (com default por distribuidor).
- **Motor de cálculo:** demanda média diária do histórico de vendas — janela default **60 dias, com período selecionável**. `estoque_ideal = demanda_diária × (lead_time + cobertura_ideal + ciclo_pedido/2)`; `sugestao_pedido = ideal − quantidade_atual`. Grava nos campos já existentes de `alwayson_estoque_distribuidor` (`estoque_minimo_calculado`, `sugestao_pedido`, `dias_cobertura`).
- **UI invertida:** o cálculo (ideal vs atual, ruptura projetada em X dias) é o destaque; a fotografia mais recente é apoio, sempre com **data de referência do snapshot** visível.
- `sugestao_pedido` é o argumento de sell-in do KAM — destacar também no one-pager (Pacote C).
- **Pré-requisito operacional:** primeiro upload do template `estoque` do Paraty.

**Migration:** tabela de parâmetros por item. Cálculo roda pós-ingestão de estoque e pós-ingestão de vendas.

### Pacote F — Comunicação (contatos → e-mail → WhatsApp)

Faseado, e compartilhando o motor do Pacote C:

1. **Fase 1 — Contatos:** cadastro de pessoas envolvidas (nome, cargo, telefone, e-mail) vinculadas a distribuidor e papel. Pré-requisito de qualquer canal; já serve à operação manual.
2. **Fase 2 — E-mail** via Resend (já integrado): resumo semanal, alertas. Valida o motor de mensagens sem custo novo.
3. **Fase 3 — WhatsApp** via API oficial (Meta Cloud API ou Twilio; **evitar APIs não-oficiais** — risco de banimento). Decidir cedo: templates exigem aprovação prévia da Meta (dias de fila); **opt-in registrado por contato com data (LGPD)**; **log de disparos** em tabela própria (quem recebeu o quê, quando, por qual regra).

**Migrations:** contatos, opt-in, log de disparos.

### Pacote G — Ingestão automatizada (WinThor / Sankhya / Consinco)

**Objetivo:** o segundo distribuidor entra pelo canal automático desde o dia um; esforço por parceiro cai de "projeto" para "checklist".

Princípio: **o contrato de dados não muda** (templates, validação, de-para, reprocessamento idempotente). Muda como o arquivo chega. Três canais em camadas:

| Canal | Como | Para quem | Esforço |
|---|---|---|---|
| **1. Drop de arquivo** (começar aqui) | ERP agenda exportação → e-mail dedicado por distribuidor ou bucket/SFTP com credencial própria → worker converte e chama `POST /api/ingest` | WinThor, Consinco, fallback universal | Homologação em dias; zero firewall, zero credencial de ERP |
| **2. Coletor** | Serviço leve na rede do parceiro roda SQL homologado (Oracle) ou API, empurra via HTTPS (só saída) | Parceiros grandes/engajados | Instalação + manutenção de versão; só construir com demanda |
| **3. API direta** | Cron no Railway puxa do gateway Sankhya | Sankhya (especialmente cloud) | Canal padrão para Sankhya |

Contexto por ERP: WinThor (Oracle; API do Anywhere depende de versão/módulo — não assumir), Sankhya (gateway REST oficial decente, cloud e on-prem), Consinco (Oracle, APIs menos padronizadas — tratar como WinThor).

**Pré-requisito técnico:** **token de serviço por distribuidor** na API de ingestão (chave de máquina com escopo distribuidor+fornecedor, revogável; a decisão de acesso continua no contexto do chamador — nunca no `service_role`). Extensão pequena, destrava os três canais.

**Kit de homologação por ERP:** pacote de extração pronto (SQL homologado por versão / configuração de relatório agendado / receita de API), checklist de ativação (cadastro → canal → credencial → carga histórica → primeira carga automática → de-para curado → SLA), e **modo validação**: primeiras N cargas automáticas entram marcadas para conferência contra o relatório manual antes de o canal virar oficial.

**SLA de dado por distribuidor** ("vendas até dia 3, estoque toda segunda") monitorado pelo motor de alertas — o "sem dados > 7 dias" do Início evolui para isso.

Primeiro caso: **migrar o próprio Paraty para o Canal 1**, virando a homologação de ponta a ponta.

### Pacote H — Explorar em escala (Nordeste)

**Decisão de arquitetura: Postgres/Supabase continua sendo o lugar certo. Sem Redis, sem Pinecone** (vetorial não tem função aqui; cache só se/quando uma agregação pesar de verdade).

Dimensionamento: Petrolina = 3.440 PDVs; extrapolação NE (~1.794 municípios) ≈ 500k–1,5M linhas em `alwayson_pdv_universo` — confortável para Postgres. O risco não é armazenar, é **consultar errado** (carregar universo no navegador).

1. **Dado bruto continua fora do banco** (como hoje): CSVs Receita/CNEFE (~66M linhas/UF) no volume do Railway; só o consolidado por PDV entra no Postgres.
2. **Tabela de resumo por município** (`alwayson_pdv_municipio_resumo`: 1 linha/município — contagem, índice agregado, cobertura). Mapa e lista regional leem só o resumo (~1.800 linhas p/ NE). Detalhe de PDVs carrega ao entrar no município, paginado, índice por `codigo_ibge`.
3. **Refresh do resumo pós-carga** do pipeline, auditado em `alwayson_pdv_pipeline_execucoes`.
4. **Expansão gradual por UF:** PE completo primeiro; validar tempo de carga e volume antes das outras 8 UFs.

### Pacote I — Radar de Oportunidades (fluxo de agentes)

**Objetivo:** um fluxo de agentes especialista em varrer o dado e **encontrar oportunidades que o KAM não pediu para ver** — o complemento proativo do ciclo avaliar → agir → cobrar.

**Princípio de arquitetura: híbrido determinístico + LLM.** Números são calculados por SQL (auditável, barato, reproduzível); o agente LLM entra onde agrega de verdade — priorizar, cruzar sinais, redigir o "por quê agora" e descartar falso positivo. Nunca pedir ao LLM para calcular o que uma query calcula.

**Camada 1 — Detectores determinísticos** (SQL/workers, rodam pós-ingestão ou em cron):

| Detector | Sinal | Fonte |
|---|---|---|
| Cliente esfriando | comprava todo mês, caiu frequência/ticket | faturamento (20m de história) |
| Cliente perdido | positivava e zerou há N dias | faturamento |
| Queda de mix | comprava X SKUs, hoje compra menos | faturamento_itens |
| Cross-sell | clientes similares (porte/cidade/segmento) compram SKU que este não compra | faturamento_itens + carteira |
| Estratégico frio | CNPJ da lista estratégica sem compra no mês | lista estratégica + faturamento |
| Gap territorial | CNPJ do Insights/Explorar na praça, fora da carteira — **entra como "candidato a curadoria", nunca como alvo direto** (regra do histórico Arruda) | insights + pdv_universo |
| Ruptura à vista | estoque projetado < lead time (Pacote E) | estoque + demanda |
| Meta em risco | pacing abaixo do necessário + onde está o gap (quais clientes/SKUs explicam) | metas + faturamento |

Cada detector grava candidatos em `alwayson_oportunidades`: tipo, entidade (cliente/SKU/vendedor/território), **evidência numérica em JSON**, valor estimado (R$ de recuperação/potencial), status (`candidata` → `publicada` → `aceita`/`descartada`), `detectado_em`.

**Camada 2 — Agente analista (LLM):** job agendado (cadência semanal; sob demanda pelo KAM depois) que recebe os candidatos + contexto do distribuidor (parâmetros-alvo, metas, ações já abertas) e produz o **briefing ranqueado**: top N oportunidades com narrativa curta ("Mercadinho X comprava R$ 8k/mês de 6 SKUs; há 2 meses só leva 2 SKUs e caiu a R$ 3k — vale visita; impacto estimado R$ 5k/mês"), deduplicadas (mesmo cliente com 3 sinais = 1 oportunidade com 3 evidências) e filtradas contra ações já em andamento. Evolução natural: sub-agentes especialistas por domínio (carteira, mix, território, estoque) + um sintetizador que ranqueia — só quando o volume justificar; começa com um agente único.

**Infra:** segue o padrão já consolidado no projeto — **fila + worker com estado em coluna e claim CAS** (mesmo desenho dos enriquecimentos por CNPJ). Worker no Railway (ou Edge Function) chamando a API da Anthropic; o LLM **nunca escreve direto no banco** — devolve JSON estruturado que o worker valida e grava. Custo controlado por cadência + lote (só candidatos novos/alterados desde a última rodada).

**Saída integrada (é aqui que o pacote paga):**
- Top oportunidades aparecem na **fila de ação do Início** (Pacote A).
- Um clique converte oportunidade em **ação do plano** (Pacote C) — vínculo `oportunidade_id` na ação.
- Resumo pode sair pelo canal de **comunicação** (Pacote F): "3 oportunidades novas esta semana no Paraty".
- **Feedback loop:** aceitar/descartar fica registrado com motivo; taxa de descarte por detector calibra thresholds e o prompt do analista. Sem esse loop o radar vira ruído.

**Governança:** oportunidades de gap territorial respeitam a restrição contratual (nada do provedor externo além de CNPJ+cidade/UF) e o caveat do Insights — são sempre "para curadoria", com rótulo distinto das oportunidades de carteira.

**Migrations:** `alwayson_oportunidades` (+ índices por distribuidor/status/tipo), vínculo em ações, log de execução do agente.

## 4. Fora de escopo (registrado para depois)

- **Portal do distribuidor** (login com visão espelhada) — RLS por escopo já suporta; fase futura.
- **Registro de visita/contato ao PDV** (esforço vs resultado) — radar fase 3.
- **Tabela de preço sugerido / análise de aderência de preço** — depende de o fornecedor ter tabela.
- **Churn estruturado de clientes** — desbloqueado pelos 20 meses, mas entra depois dos pacotes acima (a fila de ação do Início já cobre o sintoma).

## 5. Pré-requisitos operacionais (não são código)

1. **Subir template `clientes` do Paraty** — destrava denominador real de cobertura/positivação e a curadoria da carteira (Pacotes B e D).
2. **Subir primeiro relatório de `estoque`** — destrava Pacote E.
3. **Confirmar tratamento de devoluções/bonificações** nos relatórios de vendas (hoje tudo soma como venda?). Com metas derivadas de nota, distorce meta se não tratado. **Decisão em aberto.**

## 6. Sequência de implementação proposta

| Fase | Conteúdo | Dependências |
|---|---|---|
| **1** | Pacote A (Início + sidebar) + Pacote B (meta de positivação) | Nenhuma técnica; pré-req. operacional 1 melhora o denominador |
| **2** | Pacote G fase 1 (token de serviço + canal drop + SLA) — migrar Paraty | — |
| **3** | Pacote D (carteira) + Pacote C parâmetros e plano de ação | Template `clientes` |
| **4** | Pacote C motor de alertas + Pacote F fases 1–2 (contatos + e-mail) | Fase 3 |
| **5** | Pacote E (estoque ideal) + Pacote I camada 1 (detectores + tabela de oportunidades) | Upload de estoque; Fase 3 (parâmetros/ações) |
| **6** | Pacote I camada 2 (agente analista + briefing no Início) + Pacote F fase 3 (WhatsApp) + Pacote H (resumo municipal + expansão PE) | Fase 5; pipeline PDV |

One-pager PDF (Pacote C.4) encaixa em qualquer folga a partir da Fase 1. Kit Sankhya/coletor (Pacote G canais 2–3) entram quando surgir o parceiro que os justifique. Os detectores do Pacote I podem ser antecipados individualmente (cliente esfriando/perdido só dependem do faturamento, que já existe) — o que trava a camada 2 é ter fila de ação e plano de ação para a saída fazer sentido.

## 7. Decisões em aberto

1. Tratamento de devoluções/bonificações no faturamento (§5.3).
2. Provedor WhatsApp: Meta Cloud API direta vs Twilio (custo × esforço de setup).
3. Recepção do Canal 1: e-mail dedicado vs bucket/SFTP (ou ambos; e-mail é o mais simples para o distribuidor).
4. Onde o plano de ação vive na UI: item de sidebar em Gestão vs bloco do Início.
5. Radar de Oportunidades: cadência da rodada do agente (semanal vs pós-ingestão) e modelo/custo por rodada — definir na spec detalhada do Pacote I, junto com os thresholds iniciais de cada detector.
