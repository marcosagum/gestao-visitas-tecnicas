# VT Manager

Gerenciador de Visitas Técnicas (VTs), com backend Postgres (Supabase) via Prisma.

## Getting started

1. Instale as dependências:

   ```bash
   npm install
   ```

2. Copie `.env.example` para `.env` (**não** `.env.local`). O Prisma CLI (via `prisma.config.ts`) só carrega o arquivo `.env` — ele não lê `.env.local`. O Next.js carrega ambos, então `.env` é o único arquivo que os dois toolchains enxergam ao mesmo tempo. Use `.env` para todas as variáveis deste projeto.

   ```bash
   cp .env.example .env
   ```

3. Preencha `DATABASE_URL` e `DIRECT_URL` a partir da página de connection strings do projeto Supabase (Project Settings → Database → Connection string):
   - `DATABASE_URL`: connection string em modo *pooled/transaction* (porta 6543, `?pgbouncer=true`) — usada **apenas em runtime pela aplicação** (`src/lib/prisma.ts`).
   - `DIRECT_URL`: connection string em modo *direct/session* ("Direct connection", porta 5432, sem pooler) — usada por **todos os comandos do Prisma CLI** (`generate`, `validate`, `migrate`, `db seed`, `studio`), pois o schema engine precisa de uma conexão direta para criar o shadow database durante `migrate dev`. É obrigatória mesmo para comandos que não mexem no shadow database.

4. Rode as migrations. Este repositório ainda não tem nenhuma migration versionada em `prisma/migrations/`, então rode:

   ```bash
   npx prisma migrate dev --name init
   ```

   Isso cria a migration inicial a partir do `schema.prisma` e a aplica no banco. Em clones futuros, depois que a migration inicial já estiver commitada, use `npx prisma migrate deploy` no lugar (não recria/não usa shadow database, seguro para produção).

5. Popule o banco com os dados de seed:

   ```bash
   npx prisma db seed
   ```

6. Suba o servidor de desenvolvimento:

   ```bash
   npm run dev
   ```

> **Aviso importante:** nunca rode `npx prisma db push` contra um projeto Supabase que hospede outras tabelas/dados não relacionados a este projeto. `db push` faz uma sincronização completa do schema e vai **apagar (DROP) silenciosamente** qualquer tabela existente no schema alvo que não esteja declarada em `schema.prisma`. Prefira sempre `prisma migrate dev` / `prisma migrate deploy`, que geram migrations versionadas e auditáveis em vez de sincronizar destrutivamente.
