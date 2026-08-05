# Pendências — o que falta para a versão definitiva

> Snapshot de **2026-08-05**, conferido direto no banco (`osukbalwykbqvoumddxz`).
> Visão de produto e sequência das fases: [`ROADMAP.md`](ROADMAP.md). Convenções e armadilhas para agentes: [`../CLAUDE.md`](../CLAUDE.md).
>
> **Antes de confiar nesta página**, reconfira o que é barato reconferir — `list_tables`, `list_migrations`, `list_edge_functions` e as contagens abaixo. Este documento envelhece mais rápido que o banco.

**Estado do dado em 2026-08-05:** 1 distribuidor · 410 clientes na carteira · 3 uploads (todos `vendas`) · 1 mês de sell-in · 130 metas · 1.327 CNPJs estratégicos · 1 cidade de atuação cadastrada · 0 critérios de acompanhamento · 2 utilizadores (admin + KAM).

---

## 1. Ações suas — não é código

### 1.1 Atualizar a API de ingestão ⚠️ prazo: antes do 2º fornecedor

`services/ingest-api` é um serviço à parte (Express + Dockerfile próprio) — **não sai no deploy da Vercel**, e o repo não regista a URL real (o doc do Railway usa placeholder).

Desde a migration `047` ela exige `fornecedor_id`. Se a instância em execução estiver atrasada:

- **Hoje não quebra nada** — o trigger da `050` infere o fornecedor enquanto o distribuidor tiver só um.
- **Com o 2º fornecedor**, a inferência deixa de ser possível: as notas nascem sem carimbo e ficam invisíveis a KAM e distribuidor (falha fechada — não vaza, mas some).

Como saber qual versão está no ar:

```bash
curl -X POST "$URL_DA_INGESTAO/api/ingest" -F "tipo=vendas" \
     -F "distribuidor_id=6b551b8c-2f3e-4b3b-94f0-c34ac59be9e4" \
     -F "periodo_referencia=2026-05-30"
```

`"fornecedor_id é obrigatório"` → atualizada. Qualquer outro erro → precisa de redeploy.

### 1.2 Purgar o commit órfão no GitHub ⚠️ restrição contratual

O nome do provedor do relatório de mercado esteve numa mensagem de commit. A história foi reescrita e forçada (`main` = `d75a9ad`), mas **o objeto antigo continua a responder no GitHub pelo SHA** `2408effab6b39ceed2c559eb83b18ca9b2705556` — comportamento normal: o force-push tira a referência, não apaga o objeto.

Num repositório **público**, isso continua legível por quem tiver o SHA. Só o suporte do GitHub purga objetos não referenciados: abrir pedido em support.github.com citando o SHA. A alternativa que resolve de vez é **tornar o repositório privado**, o que também tira de exposição o resto da documentação técnica.

### 1.3 Validar o isolamento com o KAM real ⚠️ nunca foi exercitado na interface

Já existe um utilizador com papel `kam` (2 utilizadores, 3 vínculos). Mas as policies das migrations `048`/`049`/`061` foram validadas **na álgebra** e no estado do banco — nenhuma sessão real de outro perfil passou por elas. A conta admin global não exercita nenhuma regra nova.

Teste mínimo: entrar como o KAM e confirmar que vê o Paraty e nada além, que `/admin` está bloqueado e que consegue escrever metas no recorte dele.

### 1.4 Confirmar os segredos do Resend

Não consigo ler segredos de Edge Function daqui. As funções `admin-invite-user` (v16) e `auth-recuperar-senha` (v1) estão **deployadas e ativas**, e o fallback para o e-mail nativo do Supabase foi removido — ou seja, **sem `RESEND_API_KEY` nenhum e-mail transacional sai**. Se convites e recuperação de senha estão a chegar, está configurado; se não, é aqui.

Segredos esperados: `RESEND_API_KEY`, `RESEND_FROM` (remetente verificado), `APP_PUBLIC_URL`, `ALLOWED_APP_ORIGINS`.

---

## 2. Cargas de dado pendentes

| o que | onde | por que importa |
|---|---|---|
| Template **`clientes`** | Ingestão | ⚠️ **O mais bloqueante.** Os 3 uploads são todos de `vendas`, então os 410 clientes nasceram como efeito colateral das notas — cobertura e positivação dão 100% por construção, e assim ficam por mais meses que entrem. Só este template cria o denominador |
| Sell-in retroativo (12–24 meses) | Ingestão | Há **1 mês** no banco. Sem série não há tendência, e a Performance é single-month por construção |
| Cidades de atuação | `/parceiros/:id` | **1 cidade** cadastrada. Destrava população coberta, potencial demonstrado e a régua da positivação |
| Decidir o que fazer com a classe A | `/clientes-estrategicos` | A curva ABC por UF já separou 303 A · 468 B · 556 C (migration `064`). O passo que falta é comercial, não técnico: dos 303 de classe A, quais viram alvo de facto, com que parceiro e em que prazo |
| Critérios de acompanhamento | — | **0 configurados**, e não há UI de escrita (ver 3.2) |
| Geocodificar a lista estratégica | Botão **Completar** em `/clientes-estrategicos` (admin) | **1.317 dos 1.327 sem coordenada** — o mapa fica quase vazio até isto correr. Já **não** depende de máquina com internet: a migration `066` criou a fila (`geo_status`) e a Edge Function `enrich-estrategicos-geo` (v2, ativa) faz Receita/BrasilAPI → geocoder a partir da infra do Supabase, igual ao enriquecimento da dimensão Insights. São ~45 min de lotes encadeados; fechar a aba não perde o que já gravou. O script local `npm run estrategicos:enrich-geo` continua a servir de alternativa em massa |

---

## 3. Engenharia pendente

### 3.1 Snapshot mensal da carteira ⚠️ decidir antes da carga retroativa
A carteira muda no tempo (cliente troca de vendedor). Calcular a cobertura de janeiro com a carteira de hoje distorce o histórico. Saída barata: tabela `(mês, cliente, vendedor, distribuidor)` gravada no fechamento. **Esta decisão tem prazo** — depois da carga retroativa, refazer custa muito mais.

### 3.2 Critérios de acompanhamento — falta UI e falta dono do `realizado`
`alwayson_clientes_estrategicos_config` não tem tela de escrita: critérios só entram por SQL. Mas o problema maior não é a UI — é que `realizado` não tem dono. Digitado à mão vira subjetivo e ninguém mantém. A virada é classificar o critério por natureza:

- **Automático** — derivado do que já existe (comprou no período? tem N SKUs? volume ≥ X?). Calculado por view/job, zero digitação.
- **Verificação de campo** — material de PDV, visita, ruptura. Precisa de input, mas como checklist objetivo, não como nota.

Falta a coluna de natureza em `_config` e a tela.

### 3.3 Importação de metas por planilha
Template e parser não existem — hoje só criação pela UI (130 metas já entraram por ali). ⚠️ As unique keys são índices **parciais**: `ON CONFLICT` exige repetir o predicado (`WHERE vendedor_id IS NOT NULL`), senão o Postgres devolve `42P10`.

### 3.4 Histórico de CNPJ — resolução
`alwayson_clientes_ajustes_cadastro` (migration `044`) regista o ajuste, mas **não resolve** o faturamento/Insights do CNPJ antigo para o mesmo cliente. Falta a view de resolução.

### 3.5 Upload de sell-out (Insights) pela UI
Hoje o pipeline roda fora do app (script local `npm run insights:import`).

### 3.6 Dívida de segurança
Conferido no linter em 2026-08-05:

| o quê | contagem | nota |
|---|---|---|
| Views com `SECURITY DEFINER` | **16** (ERROR) | Todas do Insights. As views novas (`045`/`046`/`062`) já usam `security_invoker` |
| Funções `SECURITY DEFINER` executáveis por `anon`/`authenticated` | 17 + 17 (WARN) | Revisar quais precisam mesmo de `EXECUTE` para `anon` |
| `function_search_path_mutable` | 2 (WARN) | As novas já fixam `search_path = ''` |
| Proteção de senha vazada (HaveIBeenPwned) | desligada (WARN) | Um toggle no painel do Auth |
| `alwayson_insights_purge_config` com RLS e zero policies | 1 (INFO) | Intencional — só `service_role` toca |

Faltam ainda apertar 2 policies `ALL USING(true)` de escrita em `alwayson_distribuidor_produto_de_para` e `alwayson_insights_produto_de_para`.

### 3.7 Zero testes automatizados
Nenhum vitest/jest. As regras que mais doeriam se quebrassem em silêncio: o `E` do KAM no escopo de acesso, cobertura/positivação, rollup editável de metas, e a paginação da lista estratégica (ver armadilha 5).

### 3.8 Decisão em aberto — `DistribuidorTab`
O KPI de topo lê `useMetas()` (metas de **todos** os distribuidores) e pega a primeira que casa. Com um distribuidor só, tanto faz; com o segundo, mostra a meta de um arbitrário. É decisão de produto: somar ou mostrar a do selecionado?

### 3.9 Responsividade — shell corrigido, telas com dado por conferir
Abaixo de `lg` (1024px) a sidebar virou drawer. A fronteira é `lg` e não `md` de propósito: a 768px os 232px fixos comiam 30% da largura.

⚠️ Validado num harness do shell real a 375/768/1024/1440 — zero rolagem horizontal, drawer fecha ao navegar, tabela rola no próprio contentor. **Não foi possível entrar com sessão real**, então as telas densas com dado (mapas do Insights, drill-down da Performance, Cliente Detalhe) não foram exercitadas. Vale uma passada no telemóvel nessas três.

### 3.10 Quem cura a lista estratégica?
A escrita territorial (`distribuidor_id IS NULL`) é só de admin; a escrita com distribuidor segue o escopo do KAM (migration `061`). Se o KAM tiver de montar a lista territorial também, é a policy `alwayson_clientes_estrategicos_insert_escopo` que muda.

---

## 4. Armadilhas que já custaram caro

Registadas aqui porque não são óbvias lendo o código.

1. **Adicionar papel exige três lugares:** enum do Postgres, tipo TS **e** o array de `isRole` na Edge Function. Os dois primeiros não bastam — a validação é em runtime.
2. **O `E` do KAM depende de um `NOT EXISTS`:** em `current_user_fornecedores_visiveis()`, o bloco que impede a expansão do conjunto para quem já pertence a um fornecedor. Removê-lo transforma o `E` em `OU` silenciosamente.
3. **Metas: leia pela view, nunca pela tabela.** `valor_realizado` e `percentual_atingimento` não são colunas — são derivados em `alwayson_metas_v_acompanhamento`.
4. **Tabela nova com os dois eixos precisa do trigger de carimbo** (`fn_alwayson_default_fornecedor_por_distribuidor`), senão a linha nasce com fornecedor NULL e fica invisível a não-admin.
5. **PostgREST corta em 1.000 linhas e `.limit()` não ultrapassa.** `db-max-rows` é 1.000 no Supabase: a API devolve 1.000 com status 200, sem erro. A lista estratégica ficou truncada assim, mostrando 1.000 de 1.327 sem nenhum sinal. Qualquer consulta que possa passar de 1.000 tem de paginar com `.range()` em blocos.
6. **Índices parciais exigem repetir o predicado no `ON CONFLICT`.** Vale para metas (`WHERE vendedor_id IS NOT NULL`) e para a lista estratégica (`WHERE distribuidor_id IS NULL`). Sem isso, `42P10`.
7. **Insights ≠ operação corrente.** É o histórico fechado (jan/2022–dez/2024) da operação anterior. Cruzar com a carteira de um parceiro **não** produz "clientes a conquistar".
8. **A restrição do relatório de terceiro vale para o vocabulário, não só para o texto.** Ver secção 5.

---

## 5. Restrição contratual do relatório de terceiro ⚠️ não regredir

A lista estratégica nasceu de um relatório de mercado de **provedor externo**. Por contrato, **nem as métricas dele (share, volume por marca, gap, oportunidade) nem o nome do provedor entram na plataforma** — e "plataforma" inclui **este repositório, que é público**: não em coluna, não em observação, não em nome de ficheiro, não em mensagem de commit.

Quatro decisões sustentam isso, e todas são fáceis de desfazer sem perceber:

1. **O nome do PDV não é armazenado.** A view `alwayson_clientes_estrategicos_v_lista` resolve-o na leitura por fonte pública (carteira → Receita Federal via `alwayson_pdv_universo` → histórico territorial). **626 dos 1.327 ficam sem nome** porque nenhuma dessas fontes os tem — é o preço, e é intencional. "Resolver" isso importando o nome da planilha quebra a restrição.
2. **A carga foi ordenada por CNPJ, não pela ordem da planilha.** A planilha vem por volume decrescente; inserir nessa ordem tornaria o ranking recuperável por `adicionado_em` ou ordem física. Toda recarga futura deve reordenar igual.
3. **O provedor não é um valor de `origem`.** A migration `052` tinha-o deixado no CHECK, ou seja, disponível como classificador no seletor da interface. A `063` tirou-o: uma lista vinda de relatório de terceiro entra como `potencial`.
4. **O `motivo` diz por que o PDV importa, não de onde veio.**
