# Busca e filtros na aba Cliente da Performance

> Design validado em 2026-08-11, depois de uso real. Escopo deliberadamente
> separado de `2026-08-11-performance-grafico-nivel-design.md` — são
> features diferentes (busca/filtro/layout, não o gráfico por nível), e o
> próprio usuário tirou Cliente do escopo do gráfico.

## Problema

A aba Cliente da Performance só filtra por hierarquia (Gerente/Supervisor/
Vendedor) — não há busca por nome/CNPJ nem filtro por classificação ou praça.
Com 410 clientes na carteira hoje (e crescendo), achar um cliente específico
significa rolar a tabela inteira.

## Já resolvido antes deste spec, fora do escopo aqui

O badge **"Novo"** foi corrigido em `1b0eb67` — usava `criado_em` (data de
inserção no banco), recente para 100% da carteira numa carga histórica em
massa. Agora é `nfsTotal === 1` (só uma compra na vida do cliente).

O badge **"Xd sem compra"** (`SEM_COMPRA_DIAS_LIMIAR = 60`) **já existe e já
está ligado** em `ClienteTab.tsx` — `resumo.diasSemCompra`, calculado por
`computeIntervaloSemCompra`. Não é trabalho novo desta spec; só não apareceu
no exemplo reportado porque o cliente citado (Bonanza) tem compra recente.

## Decisões

1. **Busca por texto: Nome/Razão Social e CNPJ, não Cidade/UF.** Cidade/UF
   fica só no dropdown dedicado (decisão 3) — sem duplicar o mesmo filtro em
   dois lugares. CNPJ compara dígito a dígito, ignorando pontuação — o
   usuário pode digitar formatado ou não.
2. **Filtro de Classificação, pelos mesmos badges já renderizados na linha.**
   Opções: Todos / Novo / Top / Em risco / Sem compra 60d+ / Estratégico.
   Reaproveita exatamente o que `buildClienteSinalizadores` já calcula para
   desenhar os badges — o filtro é "a linha tem esse badge no conjunto?", não
   uma lógica nova.
3. **Filtro de Cidade/UF, dropdown, não texto livre.** Populado com as
   cidades distintas resolvidas em `cidadesMap` para os clientes atualmente
   carregados — não é uma lista master de cidades do Brasil, é "o que existe
   nesta carteira".
   ⚠️ **Limitação aceita, não corrigida aqui:** `cidadesMap` vem de
   `useInsightsCidadesByCnpj`, que resolve por CNPJ contra fonte pública —
   nem todo cliente tem cidade resolvida (mesmo padrão documentado no
   `CLAUDE.md` para a lista estratégica, onde 626 de 1.327 ficam sem nome por
   falta de fonte pública). Cliente sem cidade resolvida não aparece em
   nenhuma opção do dropdown e fica de fora sempre que o filtro está ativo.
   Resolver a cobertura de geocodificação é um problema à parte, de infra —
   não desta tela.
4. **Densidade: só reduzir o padding vertical das linhas.** Mesmas colunas,
   mesma informação — cabe mais gente na tela sem rolar. Nenhuma coluna some
   nem se esconde atrás de menu.
5. **Todos os filtros — busca, hierarquia, classificação, cidade — combinam
   por E**, estreitando a mesma lista em sequência. Nenhum é exclusivo dos
   outros.

## Onde entra na tela

Busca em campo de texto próprio, acima da barra de filtros existente
(Gerente/Supervisor/Vendedor), largura cheia. Classificação e Cidade/UF
entram como `FilterField` a mais na mesma barra — quebra de linha em telas
estreitas, seguindo o padrão responsivo que `FilterBar` já tem nas outras
abas.

## Fora de escopo

- Faixa de faturamento como filtro — perguntado, não escolhido.
- Corrigir a cobertura de geocodificação (clientes sem cidade resolvida).
- Esconder colunas por padrão — densidade é só padding, não menos coluna.
- Qualquer mudança nos próprios badges além do que já foi corrigido antes
  deste spec.

## Critérios de sucesso

1. Buscar por um trecho do CNPJ (com ou sem pontuação) encontra o cliente.
2. Filtrar por "Sem compra 60d+" mostra só clientes com esse badge, e nenhum
   outro.
3. Filtrar por uma cidade mostra só clientes daquela praça; clientes sem
   cidade resolvida não aparecem em nenhuma seleção de cidade.
4. Combinar busca + Supervisor + Classificação estreita a lista pelos três ao
   mesmo tempo, não substitui um pelo outro.
5. A tabela cabe visivelmente mais linhas na tela sem rolar, com as mesmas
   sete colunas de hoje.
