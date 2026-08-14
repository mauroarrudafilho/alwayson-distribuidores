# Migração de Marca — M.I.R.A.

**Data da decisão:** 2026-08-14
**Marca anterior:** AlwaysOn Distribuidores
**Marca nova:** **M.I.R.A.**
**Expansão:** Monitoramento, Inteligência, Resultado e Ação
**Descriptor:** Plataforma de gestão de vendas para canais indiretos

## Motivo

AlwaysOn não tem domínio principal disponível e é uma expressão genérica. A nova marca precisa ser independente, replicável e vendável para fornecedores e distribuidores, sem ficar vinculada ao Grupo Arruda, a um ERP ou apenas ao módulo de distribuição.

## Arquitetura de marca

- **M.I.R.A.** — marca principal da plataforma.
- **M.I.R.A. Sales Platform** — nome comercial da suíte de gestão de vendas.
- **M.I.R.A. Connect** — ingestão, integrações e saúde do dado.
- **M.I.R.A. Performance** — performance, metas e hierarquia.
- **M.I.R.A. Radar** — oportunidades, alertas e priorização.
- **M.I.R.A. Lupa** — investigação e visualização de sinais, se o módulo for mantido com esse nome.

## Compatibilidade técnica

A migração é de marca, não de backend:

- identificadores de banco `alwayson_*` permanecem inalterados para evitar migrations destrutivas e preservar integrações;
- URLs existentes, Railway, Supabase e funções continuam funcionando até que domínios de produção sejam registrados;
- migrations e documentos históricos mantêm seus nomes originais;
- referências ao nome antigo em contexto histórico ou técnico não devem ser substituídas cegamente.

## Plano de atualização

1. Atualizar wordmark, favicon, título da aplicação, login, recuperação de senha, navegação, PDFs e textos voltados ao usuário.
2. Atualizar documentação operacional para apresentar M.I.R.A. como produto e marcar AlwaysOn como nome anterior.
3. Escolher e registrar o domínio definitivo antes de trocar URLs públicas, e-mail inbound e origens de autenticação.
4. Validar M.I.R.A. no INPI, domínios e redes sociais antes de investimento de marca.
5. Atualizar materiais comerciais, onboarding e mensagens de e-mail.
