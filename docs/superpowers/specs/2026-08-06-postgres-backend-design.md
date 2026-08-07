# Backend Postgres/Prisma para o VT Manager

## Contexto

O VT Manager (`src/app/`, `src/components/`) é um dashboard Next.js 16 / React 19 para gerenciar Visitas Técnicas (VTs) na Arena. Hoje todos os dados — VTs, salas mapeadas, notificações e briefings enviados — vivem em `localStorage`, populados a partir de mocks hardcoded em `VTDashboard.tsx`. As dependências `@prisma/client`, `@prisma/adapter-pg` e `pg` já estão instaladas, mas nenhum schema Prisma existe ainda.

Esta etapa substitui o `localStorage` por um banco Postgres real hospedado no Supabase, mantendo a UI e o fluxo de uso idênticos ao que existe hoje. Autenticação/usuários ficam fora de escopo (uso interno, sem login).

## Modelo de dados

Schema Prisma com quatro tabelas, sem relações estritas entre elas — `rooms` continua como array de strings na VT, fiel ao modelo atual da UI:

```prisma
model VisitaTecnica {
  id              String   @id @default(cuid())
  event           String
  date            DateTime
  responsible     String
  companion       String
  rooms           String[]
  clientRequests  String
  specialNotes    String
  status          VTStatus @default(pending)
  notified        Boolean  @default(false)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

enum VTStatus {
  pending
  completed
}

model Room {
  id        String   @id @default(cuid())
  name      String   @unique
  createdAt DateTime @default(now())
}

model Notification {
  id        String   @id @default(cuid())
  text      String
  read      Boolean  @default(false)
  createdAt DateTime @default(now())
}

model Briefing {
  id        String   @id @default(cuid())
  to        String
  subject   String
  body      String
  createdAt DateTime @default(now())
}
```

## API Routes

Route handlers do Next.js em `src/app/api/`:

- `GET /api/vts` — lista todas as VTs
- `POST /api/vts` — cria uma VT; dentro de uma transação Prisma, também cria o `Briefing` e a `Notification` correspondentes (hoje essa lógica roda no client dentro do callback `onSave`; passa a ser responsabilidade do servidor)
- `PATCH /api/vts/[id]` — edita campos da VT (inclui marcar `status: completed` e `notified: true`)
- `DELETE /api/vts/[id]` — exclui a VT
- `GET /api/rooms` — lista salas
- `POST /api/rooms` — adiciona sala customizada (ignora se já existir, mesmo comportamento do `handleAddCustomRoom` atual)
- `GET /api/notifications` — lista notificações
- `PATCH /api/notifications` — marca todas como lidas
- `DELETE /api/notifications` — limpa todas
- `GET /api/briefings` — lista histórico de briefings enviados

O timer client-side que verifica VTs a menos de 3h de iniciar (`setInterval` a cada 10s em `VTDashboard.tsx`) continua rodando no client; ao disparar, chama `PATCH /api/vts/[id]` com `notified: true`, e o servidor cria a `Notification` correspondente na mesma chamada.

## Integração no client

- `VTDashboard.tsx`: o `useEffect` que hoje lê `localStorage` e injeta `mockVTs` passa a fazer `fetch('/api/vts')`, `fetch('/api/rooms')`, `fetch('/api/notifications')`, `fetch('/api/briefings')` no mount.
- Cada ação do usuário (criar/editar/excluir/concluir VT, adicionar sala, marcar/limpar notificações) vira uma chamada `fetch` para a rota correspondente, seguida de atualização do estado local com a resposta da API (sem necessidade de refetch completo).
- Os mocks atuais (array `mockVTs` em `VTDashboard.tsx`) são movidos para `prisma/seed.ts`, executado uma vez via `npx prisma db seed` — não ficam mais hardcoded no componente.
- Toda leitura/escrita em `localStorage` é removida do componente.

## Setup / Infraestrutura

- Projeto Supabase criado pelo usuário; a `DATABASE_URL` (connection string em modo *pooling*, recomendado para ambientes serverless/Next.js) é fornecida por ele e configurada em `.env` (já coberto pelo `.gitignore`; **não** `.env.local` — o Prisma CLI só carrega `.env`). Ver `README.md` para a história completa de migração/setup (inclui `DIRECT_URL` para `prisma migrate dev`).
- Cliente Prisma configurado com `@prisma/adapter-pg` (já instalado) para conectar via `pg` ao Postgres do Supabase.
- `npx prisma migrate dev` cria as tabelas no banco a partir do schema acima.

## Tratamento de erros

- Rotas de API retornam `400` para payload inválido (ex: VT sem `event`/`date`/`rooms`) e `500` com mensagem genérica para falhas de banco — sem vazar detalhes internos.
- No client, chamadas `fetch` que falham exibem um `alert` simples informando a falha (o app hoje não tem nenhum tratamento de erro; este é o mínimo necessário, sem introduzir um sistema de toast/notificação novo).

## Fora de escopo

- Autenticação/usuários.
- Deploy de produção do Next.js (fica para uma etapa futura).
- Alterações visuais/de UX além do necessário para trocar a fonte de dados.
