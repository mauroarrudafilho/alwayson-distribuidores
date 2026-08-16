# Mesh — Guia de marca

Plataforma de inteligência e gestão do canal indireto. Substitui o nome Always On, já tomado por outra empresa.

Este documento é a fonte única de verdade da marca. Quem for desenhar, escrever ou codar qualquer coisa de Mesh lê isto antes.

---

## 1. Posicionamento

Mesh não é dashboard bonito, é infraestrutura de confiança entre indústria e distribuidor. A identidade precisa parecer instrumento de medição: sólida, precisa, sóbria.

Isso não é gosto pessoal, é decisão comercial. Quem precisa aceitar mandar dado para dentro de Mesh é o distribuidor, e nenhum distribuidor abre o ERP para quem se apresenta como fiscal. Visual e linguagem existem para sustentar que a visibilidade é compartilhada.

Contra quem nos posicionamos visualmente: Mtrix, Neogrid, Involves e todo software de canal com nome abstrato e azul corporativo. Nosso contraste é grafite, papel e um único ponto quente.

---

## 2. Nome

**Mesh.** Inicial maiúscula, resto minúsculo. Nunca MESH em caixa alta no texto corrido, porque puxa leitura de sigla. Nunca traduzir para Malha.

Sem artigo quando isolado: "Mesh lê os dados do distribuidor". Com artigo quando se refere a um substantivo anterior: "a plataforma Mesh", "o módulo Mesh Estoque".

**Descritor fixo:** Mesh, inteligência de canal indireto.

**Versão longa:** plataforma de inteligência e gestão do canal indireto para indústrias e representações.

**Tagline principal:** Enxergue até a ponta.

**Tagline de venda:** Do sell-in ao sell-out, sem ponto cego.

**Módulos:** marca-mãe única, módulo em português, sem nome fantasia próprio. Mesh Canal, Mesh PDV, Mesh Estoque, Mesh Metas. Cada nome fantasia extra custa memória do cliente e dilui a marca principal.

---

## 3. Voz

**Uso:** malha, nó, canal, ponta, cobertura, positivação, giro, ruptura, visibilidade, leitura, parceria.

**Evito:** monitorar, fiscalizar, controlar, auditar, vigiar, cobrar.

Frase curta, número na frente, zero adjetivo inflado. Escrevo "cobertura caiu 12% em julho", não "performance apresentou retração relevante". Uso o jargão do setor porque o interlocutor domina, e explico qualquer termo de tecnologia.

Na interface: voz ativa, o botão diz o que acontece. "Salvar alterações", não "Enviar". A ação mantém o mesmo nome do começo ao fim do fluxo. Erro explica o que houve e como resolver, sem pedir desculpa e sem ser vago. Tela vazia é convite para agir, não decoração.

---

## 4. Cor

| Papel | Nome | Hex |
|---|---|---|
| Base escura | Grafite | `#0F1115` |
| Superfície escura elevada | Grafite claro | `#1A1E26` |
| Base clara | Papel | `#F7F5F1` |
| Superfície clara elevada | Papel fosco | `#EFECE6` |
| Linhas e texto secundário | Estrutura | `#5B6572` |
| Malha | Estrutura clara | `#8B93A1` |
| Acento de marca | Âmbar | `#FF7A1A` |

**Regra que não se quebra: âmbar é cor de marca, não é cor de alerta.** A paleta de dado vive separada, com verde `#2E9E6B` para positivo, vermelho `#C94A3B` para ruptura e cinza para neutro. Se o acento da marca também significar problema, o usuário nunca sabe se o laranja na tela é decoração ou alarme.

Âmbar aparece uma vez por tela. Um único ponto quente num campo frio pesa mais do que qualquer bloco colorido.

---

## 5. Tipografia

Display e corpo na mesma família geométrica, para não multiplicar licença. Recomendação: **Geist**, com Aeonik ou Söhne como opção paga mais sofisticada.

Números **sempre tabulares**. Dashboard com algarismo proporcional desalinha coluna e faz a plataforma parecer amadora na primeira captura de tela que o cliente mandar no grupo do WhatsApp.

Escala em `tokens.css`. Não inventar tamanho fora dela.

---

## 6. A malha

O símbolo é um losango de trama triangular com um único nó aceso em âmbar. O nó fica sempre no mesmo vértice, para o olho reconhecer a marca de longe.

A malha não é padrão de fundo, é **relevo com significado**: sobe e adensa da esquerda para a direita, e o nó âmbar marca o ponto mais alto. Login, capa de relatório, deck e site usam recortes diferentes da mesma paisagem, nunca uma trama nova desenhada a cada peça.

**Regra de ouro: a malha aparece na proporção inversa ao dado na tela.**

| Contexto | Densidade | Opacidade |
|---|---|---|
| Sem dado (login, capa, hero) | cheia | 0.85 |
| Pouco dado (marketing, e-mail, slide) | média | 0.35 |
| Com dado real (dashboard, tabela) | textura mínima | 0.06 |

Essa regra sozinha resolve a maioria das decisões de layout do próximo ano sem precisar de consulta.

**Restrições técnicas:** espessura mínima de traço 1,25px, senão some em retina. SVG ancorado por canto, nunca esticado proporcionalmente, senão o relevo distorce em ultrawide. Jamais como `background-image` repetido, porque a densidade muda com o tamanho da tela.

---

## 7. Aplicações, em ordem de impacto

1. **Relatório automático enviado ao distribuidor.** É a peça de marca mais vista do produto, mais do que site e deck somados.
2. **Tela de login.** Primeiro contato do distribuidor cético.
3. **Dashboard.** Onde a marca precisa sumir para o dado aparecer.
4. **Deck comercial e slide do ponto cego** (indústria, distribuidor, PDV, com o nó âmbar no vão entre distribuidor e PDV).
5. **App do promotor**, sempre em tema claro: quem usa está em corredor de supermercado com luz forte.
6. Assinatura de e-mail, cartão, kit de campo.
7. Site institucional, por último, porque a venda hoje é consultiva e não vem de busca.

**Ritmo do site:** seções alternando grafite e papel, um único ponto âmbar por seção. Escuro para argumento, claro para explicação, escuro para a chamada final.

---

## 8. Proibido

- Degradê no logo. Morre em bordado de camisa e em impressão monocromática.
- Símbolo que só funciona grande. O favicon usa a versão simplificada, não a completa.
- Ícone de olho ou qualquer metáfora de vigilância.
- Azul corporativo de SaaS.
- Foto de pessoa sorrindo em armazém, ícone 3D, ilustração de robô. A ilustração da marca é o próprio dado.
- Caixa alta MESH em texto corrido.
- Qualquer resquício de "Always On" em código, e-mail, título de página ou contrato.

---

## 9. Pendências antes de gastar dinheiro

1. **Busca de anterioridade no INPI, classes 9 e 42.** Primeira tarefa, não a última. Todo este material vira investimento perdido se Mesh não passar. Existem marcas Mesh em pagamentos e infraestrutura de dados, mas a proteção é por classe e a coexistência é plausível. Isso precisa de confirmação formal.
2. **Vetorização profissional do símbolo.** Os SVGs deste pacote são funcionais e prontos para código, mas o desenho definitivo do símbolo e do wordmark passa por designer, com teste em 16 pixels e em impressão monocromática.
3. **Teste de pronúncia** com dois ou três distribuidores, para confirmar que ninguém lê "mexe".
4. **Decidir o destino do Always Control**, que vira módulo dentro da família Mesh com nome novo.

---

## 10. Arquivos deste pacote

| Arquivo | Para que serve |
|---|---|
| `GUIA-DE-MARCA-MESH.md` | Este documento |
| `CLAUDE.md` | Instruções operacionais para o Claude Code |
| `tokens.css` | Tokens de cor, tipo, forma e malha (Tailwind v4) |
| `tailwind.config.js` | Mesmos tokens para Tailwind v3 |
| `MeshTerrain.tsx` | Componente da camada de malha |
| `mesh-mark.svg` | Símbolo completo |
| `mesh-mark-simple.svg` | Versão simplificada para favicon e tamanhos pequenos |
| `mesh-terrain.svg` | A paisagem, usada por todas as peças |
