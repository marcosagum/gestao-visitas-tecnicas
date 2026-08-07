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
   - `DATABASE_URL`: connection string em modo *pooled/transaction* (porta 6543, `?pgbouncer=true`) — usada em runtime pela aplicação e pela maioria dos comandos do Prisma CLI.
   - `DIRECT_URL`: connection string em modo *direct/session* ("Direct connection", porta 5432, sem pooler) — necessária apenas para `prisma migrate dev`, que precisa de uma conexão direta para criar o shadow database.

4. Rode as migrations:

   ```bash
   npx prisma migrate deploy
   ```

   Se este for o primeiro clone e ainda não existir nenhuma migration versionada, use `npx prisma migrate dev` para criar a migration inicial a partir do `schema.prisma`.

5. Popule o banco com os dados de seed:

   ```bash
   npx prisma db seed
   ```

6. Suba o servidor de desenvolvimento:

   ```bash
   npm run dev
   ```

> **Aviso importante:** nunca rode `npx prisma db push` contra um projeto Supabase que hospede outras tabelas/dados não relacionados a este projeto. `db push` faz uma sincronização completa do schema e vai **apagar (DROP) silenciosamente** qualquer tabela existente no schema alvo que não esteja declarada em `schema.prisma`. Prefira sempre `prisma migrate dev` / `prisma migrate deploy`, que geram migrations versionadas e auditáveis em vez de sincronizar destrutivamente.
