import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

// This config is CLI-only (migrate/generate/seed/studio). The running app never
// imports it — it builds its own Prisma Client from DATABASE_URL directly in
// src/lib/prisma.ts. CLI commands use the direct (non-pooled) connection so that
// `prisma migrate dev` can create/drop its own temporary shadow database, which
// Supabase's pooled connection (PgBouncer) does not support. Never point this at
// the same database as DATABASE_URL via a "shadowDatabaseUrl" — Prisma resets
// (drops and recreates) the shadow database on every migrate run, and it must
// always be a separate, disposable database.
export default defineConfig({
  datasource: {
    url: env('DIRECT_URL'),
  },
  migrations: {
    seed: 'node prisma/seed.js',
  },
});
