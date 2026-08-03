# Harness de agentes — Supabase

Projeto Supabase canônico deste repo: **`osukbalwykbqvoumddxz`** (`https://osukbalwykbqvoumddxz.supabase.co`).

Variáveis locais: ver `.env.example`. Não usar **`kgzybpelluftexrewyke`** como backend deste aplicativo.

Mais detalhes: [`docs/SUPABASE_PROJECT.md`](docs/SUPABASE_PROJECT.md) · [`CLAUDE.md`](CLAUDE.md).

## Frontend — rótulos, não UUIDs

Na UI, **nunca** mostrar UUID bruto (distribuidor, fornecedor, cliente, vendedor). Usar `nome`/`labelFromOptions` (`src/lib/entity-labels.ts`); tenant fixo → campo read-only. Ver secção **UI — nunca expor UUID** em [`CLAUDE.md`](CLAUDE.md).
