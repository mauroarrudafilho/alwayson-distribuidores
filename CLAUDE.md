# AlwaysOn Distribuidores — contexto para assistentes

## Supabase (único projeto canônico deste repositório)

| | |
|--|--|
| **Project ref** | `osukbalwykbqvoumddxz` |
| **URL da API** | `https://osukbalwykbqvoumddxz.supabase.co` |

- Migrations em `docs/migrations/` e dados operacionais das tabelas `alwayson_*` vivem **somente** neste projeto.
- Ao usar Supabase MCP, CLI (`supabase link`) ou SQL Editor, confira no dashboard que o **ref** é **`osukbalwykbqvoumddxz`** antes de executar DDL/DML.
- **Não usar** o ref legado `kgzybpelluftexrewyke` para este produto: não há mais tabelas `alwayson_*` lá; apontar app, Railway ou scripts para ele quebra o fluxo.

Documentação detalhada: [`docs/SUPABASE_PROJECT.md`](docs/SUPABASE_PROJECT.md).
