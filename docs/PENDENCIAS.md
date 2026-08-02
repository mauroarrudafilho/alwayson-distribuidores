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
| Metas | `/metas` (UI pronta) | 3 dos 4 tipos (`positivacao`, `mix`, `clientes_excelencia`) dependem dos itens acima e da Excelência |
| Reatribuição de cliente entre vendedores | `/parceiros/:id/hierarquia` (UI pronta) | Correção pontual — a carga da base segue pelo template `clientes` |
| Cidades, carteira declarada, frequência de visita, início da parceria | `/parceiros/:id` (UI pronta) | Destrava população coberta, potencial demonstrado e a régua da positivação |
| Clientes foco + critérios de Excelência | — | **UI de escrita não existe** (ver C3) |

---

## C. Engenharia pendente

### C1. Importação de metas por planilha
Template e parser não existem — hoje só criação pela UI. A chave natural e a regra "planilha carrega só `valor_meta`" já estão prontas. ⚠️ As unique keys são índices **parciais**: `ON CONFLICT` exige repetir o predicado (`WHERE vendedor_id IS NOT NULL`), senão o Postgres devolve `42P10`.

### C2. Panorama mês a mês das metas — ✅ entregue
`MetasPanorama` no `AdminMetas`: linhas = responsável, colunas = meses (teto de 24), célula = atingimento com o semáforo, mais coluna de acumulado. Filtros de nível, métrica e janela.

⚠️ O acumulado **pondera pelo tamanho das metas**, não é média dos percentuais — média distorce quando as metas mensais têm tamanhos diferentes. Validado: metas de 10k e 50k com 0% e 53,7% dão **44,7% ponderado contra 26,8% de média ingênua**. Se alguém "simplificar" para média, o número muda 17 pontos.

Ganha corpo conforme a carga histórica entra; hoje mostra poucas colunas.

### C3. Excelência → **Clientes Estratégicos** (repensar, não renomear)
Decisão de produto: a Excelência vira um cadastro curado de **clientes estratégicos** — o que o time considera importante —, com acompanhamento próprio em rota dedicada. O schema atual serve de base (`excelencia_clientes` já é o cadastro de foco; `excelencia_criterios` já tem `meta`/`realizado`/`atingido`/`periodo`), mas o conceito muda: sai "plano de excelência com critérios", entra "lista estratégica monitorada". Precisa de uma passada de design antes de código.

Notas herdadas do módulo atual:
`AdminExcelencia` é **somente leitura**. O schema já serve: `excelencia_clientes` é o cadastro de clientes foco, `excelencia_criterios` já tem `meta`/`realizado`/`atingido`/`periodo`. Falta:
- UI de escrita
- coluna `origem` em `excelencia_clientes` (Scantech, indicação, decisão comercial)
- separar critério **automático** (derivado do faturamento — comprou? tem N SKUs? frequência?) de **verificação de campo** (material de PDV, visita). O que torna o critério vago não é o schema: é `realizado` não ter dono.

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
