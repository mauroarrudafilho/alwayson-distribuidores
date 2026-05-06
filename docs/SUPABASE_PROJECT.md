# Projeto Supabase (AlwaysOn Distribuidores)

**Não usar** o ref legado **`kgzybpelluftexrewyke`** como destino de migrations ou variáveis deste app — as tabelas operacionais `alwayson_*` foram removidas lá; o código e a ingestão devem usar apenas o ref abaixo.

**Este repositório aponta para o projeto:**

| Campo | Valor |
|--------|--------|
| **Project ref** | `osukbalwykbqvoumddxz` |
| **URL (API)** | `https://osukbalwykbqvoumddxz.supabase.co` |

No app Vite, use no `.env` local (não commitar chaves):

```bash
VITE_SUPABASE_URL=https://osukbalwykbqvoumddxz.supabase.co
VITE_SUPABASE_ANON_KEY=<anon public key do dashboard deste projeto>
```

Migrations em `docs/migrations/` devem ser aplicadas **neste** projeto no SQL Editor ou via CLI linkado a `osukbalwykbqvoumddxz`. O backend de ingestão (Railway) deve usar a mesma URL e a **service role** só deste projeto.

## Vários projetos Supabase no Cursor (mesma máquina)

Não existe, hoje, um “catálogo oficial” dentro do MCP onde você cadastra **N** projetos e escolhe um por clique: o que varia é **(a)** qual servidor MCP você usa e **(b)** se a ferramenta aceita `project_id` em cada chamada.

1. **Referência por repositório (recomendado)**  
   Cada pasta de projeto tem a **fonte da verdade** (esta doc + `CLAUDE.md` / `.env.example`): o **ref** correto fica explícito no repo. Quem for operar (você ou o assistente) deve **sempre** confirmar o ref da tabela acima antes de rodar SQL ou migrations.

2. **MCP Supabase com `project_id` obrigatório**  
   Preferir integrações onde **cada** chamada recebe `project_id` (por exemplo o fluxo que usamos com `osukbalwykbqvoumddxz`). Assim não depende de “qual projeto está selecionado” no painel no momento do OAuth.

3. **MCP que devolve um único `get_project_url` fixo**  
   Se uma instância do MCP estiver amarrada ao projeto errado (ex.: ref legado), **reconfigurar ou reautenticar** esse MCP no Cursor, **ou** registrar **dois servidores MCP** com nomes distintos (ex. `supabase-alwayson`, `supabase-outro`) — cada um com sessão/credencial ligada ao projeto certo, se a UI do Cursor permitir duplicar entradas.

4. **CLI por repo**  
   Em cada repositório: `supabase link --project-ref <ref>` (e `supabase db push` / SQL local). O “projeto ativo” é o do **diretório**, não o MCP global.

**Resumo:** você não precisa “atualizar” o Supabase em si a cada troca de repo; precisa de **(i)** ref documentado no repo, **(ii)** ferramentas que usem esse ref explicitamente ou **(iii)** duas entradas MCP / duas sessões se quiser alternar sem reconfigurar.
