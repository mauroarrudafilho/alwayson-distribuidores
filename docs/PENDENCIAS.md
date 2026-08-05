# Pendências — o que falta para a versão definitiva

> Snapshot de **2026-08-02**. Consolida o que ficou em aberto ao fim da sessão de migrations `043`–`050`.
> Visão de produto e sequência das fases: [`docs/ROADMAP.md`](ROADMAP.md). Convenções e armadilhas para agentes: [`CLAUDE.md`](../CLAUDE.md).

---

## A. Só você pode fazer — configuração e acesso

Nada aqui é código. São passos manuais que a sessão não conseguiu executar (ferramentas sob aprovação, rede de saída bloqueada) ou que dependem de credencial sua.

### A1. Publicar a Edge Function de convites ⚠️ bloqueia criar utilizador

`admin-invite-user` existe no repo e é invocada por `AdminUsuarios.tsx`, mas **não está deployada** — o projeto só tem `process-insights-pendentes`. Convidar alguém hoje falha com function-not-found.

```bash
npx supabase login          # se reclamar de autenticação
npm run admin:deploy-invite-fn
```

### A2. Segredos do Resend (opcional, mas recomendado)

Supabase → Edge Functions → Secrets:

| segredo | efeito |
|---|---|
| `RESEND_API_KEY` | ativa a entrega por Resend |
| `RESEND_FROM` | remetente **verificado** no Resend, ex. `AlwaysOn <nao-responda@grupoarruda.com>` |

Sem `RESEND_API_KEY` a função mantém o e-mail nativo do Supabase — a integração é opt-in e não muda comportamento sozinha. O default `onboarding@resend.dev` só serve para teste.

### A3. Atualizar a API de ingestão ⚠️ prazo: antes do 2º fornecedor

`services/ingest-api` é um serviço à parte (Express + Dockerfile próprio) — **não sai no deploy da Vercel** e o repo não registra a URL real (o doc do Railway usa placeholder).

Desde a migration `047` ela exige `fornecedor_id`. Se a instância em execução estiver atrasada:

- **Hoje não quebra nada** — o trigger da migration `050` infere o fornecedor enquanto o distribuidor tem só um.
- **Quando entrar o 2º fornecedor**, a inferência deixa de ser possível: as notas nascem sem carimbo e ficam invisíveis para KAM e distribuidor (falha fechada, não vaza).

Como saber qual versão está no ar:

```bash
curl -X POST "$URL_DA_INGESTAO/api/ingest" -F "tipo=vendas" \
     -F "distribuidor_id=6b551b8c-2f3e-4b3b-94f0-c34ac59be9e4" \
     -F "periodo_referencia=2026-05-30"
```

`"fornecedor_id é obrigatório"` → atualizada. Qualquer outro erro → precisa de redeploy.

### A4. Validar o isolamento com um utilizador real ⚠️ nunca foi exercitado

As policies das migrations `048`/`049` foram validadas **na álgebra** (matriz de 3 perfis × 2 fornecedores × 2 distribuidores) e no estado do banco — mas nenhuma sessão real de outro perfil passou por elas. A conta admin global não exercita nenhuma regra nova.

Teste mínimo: convidar um KAM com fornecedor Campestre + distribuidor Paraty e conferir na interface que ele vê os dados do Paraty e nada além.

---

## B. Cargas de dado pendentes

| o que | onde | por que importa |
|---|---|---|
| Template **`clientes`** (não só `vendas`) | Ingestão | É o **denominador**. Sem ele, cobertura/positivação dá 100% por construção, por mais meses que entrem |
| Sell-in retroativo (12–24 meses) | Ingestão | Sem série não há tendência; a Performance é single-month por construção |
| Metas | `/metas` (UI pronta) | 3 dos 4 tipos (`positivacao`, `mix`, `clientes_estrategicos`) dependem dos itens acima e da lista estratégica |
| Reatribuição de cliente entre vendedores | `/parceiros/:id/hierarquia` (UI pronta) | Correção pontual — a carga da base segue pelo template `clientes` |
| Cidades, carteira declarada, frequência de visita, início da parceria | `/parceiros/:id` (UI pronta) | Destrava população coberta, potencial demonstrado e a régua da positivação |
| ~~Lista de clientes estratégicos~~ — ✅ 1.327 CNPJs carregados | `/clientes-estrategicos` | Corte de mercado do 1º semestre/2026, 9 UFs. **Falta curadoria**: todos entraram com `prioridade = media` e o mesmo motivo genérico. Refinar por praça e definir quais viram alvo comercial de facto |
| Critérios de acompanhamento | — | **UI de escrita não existe** — só por SQL em `alwayson_clientes_estrategicos_config` (ver C3) |

---

## C. Engenharia pendente

### C1. Importação de metas por planilha
Template e parser não existem — hoje só criação pela UI. A chave natural e a regra "planilha carrega só `valor_meta`" já estão prontas. ⚠️ As unique keys são índices **parciais**: `ON CONFLICT` exige repetir o predicado (`WHERE vendedor_id IS NOT NULL`), senão o Postgres devolve `42P10`.

### C2. Panorama mês a mês das metas — ✅ entregue
`MetasPanorama` no `AdminMetas`: linhas = responsável, colunas = meses (teto de 24), célula = atingimento com o semáforo, mais coluna de acumulado. Filtros de nível, métrica e janela.

⚠️ O acumulado **pondera pelo tamanho das metas**, não é média dos percentuais — média distorce quando as metas mensais têm tamanhos diferentes. Validado: metas de 10k e 50k com 0% e 53,7% dão **44,7% ponderado contra 26,8% de média ingênua**. Se alguém "simplificar" para média, o número muda 17 pontos.

Ganha corpo conforme a carga histórica entra; hoje mostra poucas colunas.

### C3. Excelência → **Clientes Estratégicos** — ✅ entregue (com uma ponta solta)
Migration `052`: as três tabelas `alwayson_excelencia_*` viraram `alwayson_clientes_estrategicos*` (estavam vazias, rename sem risco), a lista ganhou `motivo`/`origem`/`prioridade`/`observacao`/autoria e policies de escrita admin. Rota `/clientes-estrategicos`, com `/excelencia` e `/admin/excelencia` redirecionando.

O conceito mudou de "plano com critérios" para **lista curada e manual**: cada cliente entra com o seu próprio motivo e é acompanhado por ali. Consequências de design que valem lembrar:
- A lista **existe sem critério nenhum** configurado. O acompanhamento é camada por cima — por isso `deriveScoreLabel` devolve `sem_criterios` em vez de `fora_do_padrao` quando não há régua; senão toda lista nova nasceria vermelha.
- A flag `plano_excelencia` em `alwayson_clientes_distribuidor` ficou **vestigial** (nunca foi alimentada pela ingestão, 0 linhas true). Dashboard, badge do cliente e sinalizadores passaram a ler a lista curada. A coluna continua no banco, marcada como tal no tipo TS.
- O tipo de meta `clientes_excelencia` virou `clientes_estrategicos` (CHECK atualizado no mesmo migration).

**Ponta solta — quem cura a lista?** Hoje a escrita é `current_user_is_admin()`, seguindo a convenção das migrations `028`/`035`/`044`. Se o KAM tiver de montar a lista do distribuidor dele, a policy a mudar é `alwayson_clientes_estrategicos_insert_admin`/`_update_admin` — trocar por `current_user_is_admin() OR distribuidor_id IN (select ... current_user_distribuidores_visiveis())`.

**Ainda por fazer:** separar critério **automático** (derivado do faturamento — comprou? tem N SKUs? frequência?) de **verificação de campo** (material de PDV, visita). O que torna o critério vago não é o schema: é `realizado` não ter dono. Além disso, `alwayson_clientes_estrategicos_config` continua sem UI de escrita — os critérios só entram por SQL.

### C3b. Responsividade — shell corrigido, telas com dado por conferir
Abaixo de `lg` (1024px) a sidebar deixou de ocupar espaço fixo e virou drawer, aberto por uma barra superior própria. A fronteira é `lg` e não `md` de propósito: a 768px os 232px fixos comiam 30% da largura. Também empilham no telemóvel: cabeçalho de página (título / descrição / ações), campos lado a lado dos diálogos. Faixas de abas rolam na horizontal (`.tab-strip`) em vez de quebrar linha.

⚠️ **O que foi verificado e o que não foi.** A validação correu num harness temporário que monta o shell real e os primitivos (`PageHeader`, `FilterBar`, `KPIGrid`, `Table`, faixa de abas) a 375/768/1024/1440 — nenhuma rolagem horizontal da página em nenhuma largura, drawer abre e fecha ao navegar, tabela rola dentro do próprio contentor. **Não foi possível entrar com sessão real**, então as telas densas com dado — mapas do Insights, drill-down da Performance, Cliente Detalhe — não foram exercitadas com conteúdo verdadeiro. Vale uma passada no telemóvel nessas três.

### C3c. Restrição contratual do relatório de terceiro ⚠️ não regredir
A lista estratégica nasceu de um relatório de mercado de **provedor externo**. Por contrato, **nem as métricas dele (share, volume por marca, gap, oportunidade) nem o nome do provedor entram na plataforma** — e "plataforma" inclui este repositório, que é público — nem em coluna, nem em observação, nem em nome de arquivo. O que foi carregado é apenas: CNPJ, cidade e UF.

Duas decisões que sustentam isso e que é fácil desfazer sem perceber:
- **O nome do PDV não é armazenado.** A view `alwayson_clientes_estrategicos_v_lista` resolve-o na leitura por fonte pública (carteira → Receita Federal via `alwayson_pdv_universo` → histórico territorial). 626 dos 1.327 ficam sem nome porque nenhuma dessas fontes os tem — é o preço, e é intencional. Se alguém "resolver" isso importando o nome da planilha, quebra a restrição.
- **A carga foi ordenada por CNPJ, não pela ordem da planilha.** A planilha vem ordenada por volume decrescente; inserir nessa ordem tornaria o ranking de share recuperável por `adicionado_em`/ordem física. Toda recarga futura deve reordenar igual.

### C4. Snapshot mensal da carteira
A carteira muda no tempo (cliente troca de vendedor). Calcular a cobertura de janeiro com a carteira de hoje distorce o histórico. Saída barata: tabela `(mês, cliente, vendedor, distribuidor)` gravada no fechamento. **Decidir antes da carga retroativa.**

### C5. Histórico de CNPJ — resolução
`alwayson_clientes_ajustes_cadastro` (migration `044`) registra o ajuste, mas **não resolve** o faturamento/Insights do CNPJ antigo para o mesmo cliente. Falta a view de resolução (Fase 3 do plano de 2026-04-27).

### C6. Upload de sell-out (Insights) pela UI
Hoje esse pipeline roda fora do app (script local `npm run insights:import`).

### C7. Dívida de segurança que sobrou
- ~16 views do Insights com `SECURITY DEFINER` (ERROR no linter). As views novas (`045`/`046`) já usam `security_invoker`.
- 2 policies `ALL USING(true)` de escrita em `alwayson_distribuidor_produto_de_para` e `alwayson_insights_produto_de_para` — apertar para `current_user_is_admin()`.
- Proteção de senha vazada (HaveIBeenPwned) desligada no Auth.

### C8. Zero testes automatizados
Nenhum vitest/jest. As regras que mais doeriam se quebrassem em silêncio: escopo de acesso (o `E` do KAM), cobertura/positivação, rollup editável de metas.

### C9. Decisão em aberto — `DistribuidorTab`
O KPI de topo lê `useMetas()` (metas de **todos** os distribuidores) e pega a primeira que casa. Com um distribuidor só, tanto faz; com o segundo, mostra a meta de um arbitrário. É decisão de produto: somar as metas dos distribuidores ou mostrar a de um selecionado?

---

## D. Armadilhas que já custaram caro

Registradas aqui porque não são óbvias lendo o código.

1. **Adicionar papel exige três lugares:** enum do Postgres, tipo TS **e** o array de `isRole` na Edge Function. Só os dois primeiros não basta — a validação é em runtime.
2. **O `E` do KAM depende de um `NOT EXISTS`:** em `current_user_fornecedores_visiveis()`, o bloco que impede a expansão do conjunto para quem já pertence a um fornecedor. Removê-lo transforma o `E` em `OU` silenciosamente.
3. **Metas: leia pela view, nunca pela tabela.** `valor_realizado` e `percentual_atingimento` não são colunas — são derivados em `alwayson_metas_v_acompanhamento`.
4. **Tabela nova com os dois eixos precisa do trigger de carimbo** (`fn_alwayson_default_fornecedor_por_distribuidor`), senão a linha nasce com fornecedor NULL e fica invisível a não-admin.
5. **Insights ≠ operação corrente.** É o histórico fechado (jan/2022–dez/2024) da operação anterior. Cruzar com a carteira de um parceiro **não** produz "clientes a conquistar".
