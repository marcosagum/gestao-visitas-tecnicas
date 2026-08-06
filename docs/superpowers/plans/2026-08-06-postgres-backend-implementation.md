# Backend Postgres/Prisma para o VT Manager - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o `localStorage` do VT Manager por persistência real em Postgres (Supabase), via Prisma e API Routes do Next.js, sem alterar o comportamento visual/funcional do dashboard.

**Architecture:** Next.js App Router com Route Handlers em `src/app/api/*` fazendo a ponte entre `VTDashboard.tsx` e um Postgres hospedado no Supabase, acessado via Prisma Client com o driver adapter `@prisma/adapter-pg`. `VTDashboard.tsx` troca leitura/escrita em `localStorage` por chamadas `fetch` às rotas.

**Tech Stack:** Next.js 16, React 19, TypeScript, Prisma 7 (`@prisma/client`, `@prisma/adapter-pg`, `pg`), Postgres (Supabase), Vitest (testes das rotas de API).

## Global Constraints

- Sem autenticação/usuários nesta etapa (uso interno, sem login) — conforme spec.
- Nenhuma leitura/escrita em `localStorage` deve permanecer em `VTDashboard.tsx` ao final do plano.
- Toda a lógica de negócio (auto-criação de briefing/notificação ao agendar VT, notificação ao se aproximar o horário) roda no servidor (route handlers), não no client.
- Rotas de API retornam `400` para payload inválido e `500`/`404` para falhas de banco, sem vazar detalhes internos no corpo da resposta.
- Sem alterações visuais/de UX além do necessário para trocar a fonte de dados (spec, seção "Fora de escopo").
- Especificação completa em `docs/superpowers/specs/2026-08-06-postgres-backend-design.md`.

---

### Task 1: Prisma schema, client singleton e seed script

**Files:**
- Create: `prisma/schema.prisma`
- Create: `src/lib/prisma.ts`
- Create: `prisma/seed.js`
- Create: `.env.example`

**Interfaces:**
- Produces: `prisma` (Prisma Client singleton, exportado de `src/lib/prisma.ts`) — usado por todas as rotas de API nas tasks seguintes.
- Produces: models Prisma `VisitaTecnica`, `Room`, `Notification`, `Briefing` com os campos definidos abaixo.

- [ ] **Step 1: Criar o schema Prisma**

Criar `prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum VTStatus {
  pending
  completed
}

model VisitaTecnica {
  id             String   @id @default(cuid())
  event          String
  date           DateTime
  responsible    String
  companion      String
  rooms          String[]
  clientRequests String
  specialNotes   String
  status         VTStatus @default(pending)
  notified       Boolean  @default(false)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@map("visitas_tecnicas")
}

model Room {
  id        String   @id @default(cuid())
  name      String   @unique
  createdAt DateTime @default(now())

  @@map("rooms")
}

model Notification {
  id        String   @id @default(cuid())
  text      String
  read      Boolean  @default(false)
  createdAt DateTime @default(now())

  @@map("notifications")
}

model Briefing {
  id        String   @id @default(cuid())
  to        String
  subject   String
  body      String
  createdAt DateTime @default(now())

  @@map("briefings")
}
```

- [ ] **Step 2: Criar o singleton do Prisma Client com o driver adapter**

Criar `src/lib/prisma.ts`:

```ts
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

declare global {
  var __prisma: PrismaClient | undefined;
}

function createPrismaClient() {
  const adapter = new PrismaPg(process.env.DATABASE_URL ?? '');
  return new PrismaClient({ adapter });
}

export const prisma = globalThis.__prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma;
}
```

- [ ] **Step 3: Criar o exemplo de variável de ambiente**

Criar `.env.example`:

```
DATABASE_URL="postgresql://postgres:[PASSWORD]@[HOST]:6543/postgres?pgbouncer=true"
```

- [ ] **Step 4: Criar o seed script**

Criar `prisma/seed.js` (CommonJS puro, compatível com o script `"seed": "node prisma/seed.js"` já configurado em `package.json`):

```js
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const defaultRooms = [
  'Palco Principal',
  'Camarins A/B',
  'Sala de Controle / FOH',
  'Área de Credenciamento',
  'Praça de Alimentação',
  'Acessos / Bilheteria',
  'Camarotes VIP',
  'Estacionamento / Carga',
];

const daysFromNow = (days) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);

const mockVTs = [
  {
    event: 'Kid Abelha - Reunião de Alinhamento Arena',
    date: daysFromNow(2),
    responsible: 'Marcos Agum',
    companion: 'Roberto (Produtor Kid Abelha)',
    rooms: ['Palco Principal', 'Camarins A/B', 'Sala de Controle / FOH'],
    clientRequests: 'Necessidade de 12 canais de retorno sem fio IEM (In-Ear Monitor). O rider técnico exige camarim com ar condicionado forte.',
    specialNotes: 'Medir largura da rampa de acesso lateral ao palco para cases grandes de som.',
    status: 'pending',
    notified: false,
  },
  {
    event: 'Festival de Dança - Ensaio Geral',
    date: daysFromNow(0),
    responsible: 'Ana Carolina',
    companion: 'Clara Ramos (Diretora do Festival)',
    rooms: ['Palco Principal', 'Camarins A/B'],
    clientRequests: 'Necessidade de iluminação especial cênica de LED e piso de linóleo sobre o palco.',
    specialNotes: 'Verificar se a temperatura do ar condicionado da plateia pode ser mantida em 22°C.',
    status: 'pending',
    notified: false,
  },
  {
    event: 'Show Lançamento Sertanejo - Montagem',
    date: daysFromNow(1),
    responsible: 'Thiago Silva',
    companion: 'Gustavo Lima (Diretoria Artística)',
    rooms: ['Palco Principal', 'Estacionamento / Carga', 'Camarotes VIP'],
    clientRequests: 'Instalação de sonorização complementar nos camarotes VIP e rampa especial de acesso de cargas.',
    specialNotes: 'Exige gerador de energia trifásico de 250kVA reserva para painel de LED principal.',
    status: 'pending',
    notified: false,
  },
  {
    event: 'Convenção Inova 2026 - Alinhamento TI',
    date: daysFromNow(3),
    responsible: 'Felipe Castro',
    companion: 'Mariana Costa (Produtora Inova)',
    rooms: ['Área de Credenciamento', 'Praça de Alimentação', 'Acessos / Bilheteria'],
    clientRequests: 'Necessidade de link dedicado de internet de 500Mbps na área de credenciamento e totens de autoatendimento.',
    specialNotes: 'Check de roteadores Wi-Fi corporativos redundantes cobrindo a praça de alimentação inteira.',
    status: 'pending',
    notified: false,
  },
  {
    event: 'Congresso de Medicina - Expositores',
    date: daysFromNow(5),
    responsible: 'Dr. Leonardo',
    companion: 'Patricia Albuquerque (CRM Eventos)',
    rooms: ['Estacionamento / Carga', 'Praça de Alimentação', 'Acessos / Bilheteria'],
    clientRequests: 'Pontos de energia monofásicos em cada stand (total de 45 stands) na praça de alimentação.',
    specialNotes: 'Auditoria de segurança das instalações temporárias de gás na praça de alimentação.',
    status: 'pending',
    notified: false,
  },
  {
    event: 'Futebol Beneficente - Cobertura TI',
    date: daysFromNow(-1),
    responsible: 'Lucas Pereira',
    companion: 'Eduardo (Diretor de TI)',
    rooms: ['Camarotes VIP', 'Acessos / Bilheteria'],
    clientRequests: 'Configuração de rede interna para transmissão de streaming ao vivo de alta velocidade.',
    specialNotes: 'Cabeamento de fibra ótica temporário passando pelos camarotes VIP.',
    status: 'completed',
    notified: true,
  },
];

async function main() {
  await prisma.room.createMany({
    data: defaultRooms.map((name) => ({ name })),
    skipDuplicates: true,
  });

  for (const vt of mockVTs) {
    await prisma.visitaTecnica.create({ data: vt });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
```

- [ ] **Step 5: Validar o schema e a sintaxe do seed (sem precisar de banco real ainda)**

Rodar:
```bash
npx prisma validate
node --check prisma/seed.js
```
Esperado: ambos sem erro (`prisma validate` confirma que o schema é sintaticamente válido; `node --check` confirma que o seed script não tem erro de sintaxe). Nenhum dos dois comandos conecta ao banco.

- [ ] **Step 6: Gerar o Prisma Client**

Rodar:
```bash
npx prisma generate
```
Esperado: `Generated Prisma Client` sem erros — isso cria os tipos TypeScript (`VisitaTecnica`, `Room`, `Notification`, `Briefing`, `VTStatus`) usados pelas próximas tasks.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/seed.js src/lib/prisma.ts .env.example
git commit -m "feat: add Prisma schema, client singleton and seed script"
```

---

### Task 2: Tooling de testes (Vitest) + rota /api/vts (GET, POST)

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `src/app/api/vts/route.ts`
- Test: `src/app/api/vts/route.test.ts`

**Interfaces:**
- Consumes: `prisma` de `@/lib/prisma` (Task 1).
- Produces: `GET`, `POST` exportados de `src/app/api/vts/route.ts`. `POST` espera body `{ event, date, responsible, companion, rooms, clientRequests, specialNotes }` e responde com o registro `VisitaTecnica` criado (status 201) ou `{ error }` (status 400/500).

- [ ] **Step 1: Instalar o Vitest**

```bash
npm install -D vitest vite-tsconfig-paths
```

- [ ] **Step 2: Configurar o Vitest**

Criar `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
  },
});
```

Em `package.json`, adicionar o script `test` dentro de `"scripts"`:

```json
"test": "vitest run"
```

- [ ] **Step 3: Escrever o teste falho**

Criar `src/app/api/vts/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '@/lib/prisma';
import { GET, POST } from './route';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    visitaTecnica: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    briefing: {
      create: vi.fn(),
    },
    notification: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
    async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma)
  );
});

describe('GET /api/vts', () => {
  it('returns the list of VTs from prisma', async () => {
    const fakeVTs = [{ id: 'vt-1', event: 'Show Teste' }];
    (prisma.visitaTecnica.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(fakeVTs);

    const response = await GET();
    const body = await response.json();

    expect(prisma.visitaTecnica.findMany).toHaveBeenCalledWith({ orderBy: { date: 'asc' } });
    expect(body).toEqual(fakeVTs);
  });
});

describe('POST /api/vts', () => {
  it('returns 400 when required fields are missing', async () => {
    const request = new Request('http://localhost/api/vts', {
      method: 'POST',
      body: JSON.stringify({ event: '' }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(prisma.visitaTecnica.create).not.toHaveBeenCalled();
  });

  it('creates the VT plus its briefing and notification in a transaction', async () => {
    const createdVT = {
      id: 'vt-1',
      event: 'Show Teste',
      date: new Date('2026-08-10T14:30:00'),
      responsible: 'Marcos Agum',
      companion: 'Roberto',
      rooms: ['Palco Principal'],
      clientRequests: 'Som',
      specialNotes: 'Nenhuma',
      status: 'pending',
      notified: false,
    };
    (prisma.visitaTecnica.create as ReturnType<typeof vi.fn>).mockResolvedValue(createdVT);
    (prisma.briefing.create as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (prisma.notification.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const request = new Request('http://localhost/api/vts', {
      method: 'POST',
      body: JSON.stringify({
        event: 'Show Teste',
        date: '2026-08-10T14:30',
        responsible: 'Marcos Agum',
        companion: 'Roberto',
        rooms: ['Palco Principal'],
        clientRequests: 'Som',
        specialNotes: 'Nenhuma',
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toEqual({ ...createdVT, date: createdVT.date.toISOString() });
    expect(prisma.briefing.create).toHaveBeenCalledTimes(1);
    expect(prisma.notification.create).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 4: Rodar o teste e confirmar que falha**

```bash
npx vitest run src/app/api/vts/route.test.ts
```
Esperado: FAIL — `./route` não existe ainda (erro de módulo não encontrado).

- [ ] **Step 5: Implementar a rota**

Criar `src/app/api/vts/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const vts = await prisma.visitaTecnica.findMany({
    orderBy: { date: 'asc' },
  });
  return NextResponse.json(vts);
}

interface CreateVTBody {
  event: string;
  date: string;
  responsible: string;
  companion: string;
  rooms: string[];
  clientRequests: string;
  specialNotes: string;
}

function validateCreateVTBody(body: Partial<CreateVTBody>): string | null {
  if (!body.event || !body.event.trim()) return 'event é obrigatório';
  if (!body.date) return 'date é obrigatório';
  if (!body.responsible || !body.responsible.trim()) return 'responsible é obrigatório';
  if (!body.companion || !body.companion.trim()) return 'companion é obrigatório';
  if (!Array.isArray(body.rooms) || body.rooms.length === 0) return 'rooms deve ter ao menos uma sala';
  if (!body.clientRequests || !body.clientRequests.trim()) return 'clientRequests é obrigatório';
  if (!body.specialNotes || !body.specialNotes.trim()) return 'specialNotes é obrigatório';
  return null;
}

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<CreateVTBody>;
  const validationError = validateCreateVTBody(body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  try {
    const vt = await prisma.$transaction(async (tx) => {
      const created = await tx.visitaTecnica.create({
        data: {
          event: body.event!,
          date: new Date(body.date!),
          responsible: body.responsible!,
          companion: body.companion!,
          rooms: body.rooms!,
          clientRequests: body.clientRequests!,
          specialNotes: body.specialNotes!,
        },
      });

      await tx.briefing.create({
        data: {
          to: `${created.responsible.replace(/\s+/g, '.').toLowerCase()}@arena.com.br`,
          subject: `Briefing Técnico: ${created.event}`,
          body: `Visita agendada para: ${created.date.toLocaleString('pt-BR')}.\nSalas: ${created.rooms.join(', ')}.\nSolicitação Cliente: ${created.clientRequests}\nConsiderações Especiais: ${created.specialNotes}`,
        },
      });

      await tx.notification.create({
        data: {
          text: `Novo briefing de VT enviado para ${created.responsible} ("${created.event}").`,
        },
      });

      return created;
    });

    return NextResponse.json(vt, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar VT', error);
    return NextResponse.json({ error: 'Erro ao criar a Visita Técnica' }, { status: 500 });
  }
}
```

- [ ] **Step 6: Rodar o teste e confirmar que passa**

```bash
npx vitest run src/app/api/vts/route.test.ts
```
Esperado: PASS (3 testes).

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/app/api/vts/route.ts src/app/api/vts/route.test.ts
git commit -m "feat: add /api/vts route with vitest tooling"
```

---

### Task 3: Rota /api/vts/[id] (PATCH, DELETE)

**Files:**
- Create: `src/app/api/vts/[id]/route.ts`
- Test: `src/app/api/vts/[id]/route.test.ts`

**Interfaces:**
- Consumes: `prisma` de `@/lib/prisma` (Task 1).
- Produces: `PATCH`, `DELETE` exportados de `src/app/api/vts/[id]/route.ts`. `PATCH` aceita qualquer subconjunto dos campos da VT; se `notified: true` for enviado, cria também uma `Notification`. Responde com o registro atualizado ou `{ error }` (status 404).

- [ ] **Step 1: Escrever o teste falho**

Criar `src/app/api/vts/[id]/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '@/lib/prisma';
import { PATCH, DELETE } from './route';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    visitaTecnica: {
      update: vi.fn(),
      delete: vi.fn(),
    },
    notification: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
    async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma)
  );
});

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe('PATCH /api/vts/[id]', () => {
  it('updates the VT and returns it', async () => {
    const updatedVT = { id: 'vt-1', status: 'completed' };
    (prisma.visitaTecnica.update as ReturnType<typeof vi.fn>).mockResolvedValue(updatedVT);

    const request = new Request('http://localhost/api/vts/vt-1', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'completed' }),
    });

    const response = await PATCH(request, makeParams('vt-1'));
    const body = await response.json();

    expect(prisma.visitaTecnica.update).toHaveBeenCalledWith({
      where: { id: 'vt-1' },
      data: { status: 'completed' },
    });
    expect(body).toEqual(updatedVT);
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('converts the date field to a Date before updating', async () => {
    (prisma.visitaTecnica.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'vt-1',
      event: 'Show Teste',
      date: new Date('2026-08-10T14:30:00'),
    });

    const request = new Request('http://localhost/api/vts/vt-1', {
      method: 'PATCH',
      body: JSON.stringify({ date: '2026-08-10T14:30' }),
    });

    await PATCH(request, makeParams('vt-1'));

    const call = (prisma.visitaTecnica.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.data.date).toBeInstanceOf(Date);
  });

  it('creates a notification when notified is set to true', async () => {
    (prisma.visitaTecnica.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'vt-1',
      event: 'Show Teste',
      date: new Date('2026-08-10T14:30:00'),
    });

    const request = new Request('http://localhost/api/vts/vt-1', {
      method: 'PATCH',
      body: JSON.stringify({ notified: true }),
    });

    await PATCH(request, makeParams('vt-1'));

    expect(prisma.notification.create).toHaveBeenCalledTimes(1);
    const call = (prisma.notification.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.data.text).toContain('Show Teste');
  });

  it('returns 404 when the VT does not exist', async () => {
    (prisma.visitaTecnica.update as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('not found'));

    const request = new Request('http://localhost/api/vts/missing', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'completed' }),
    });

    const response = await PATCH(request, makeParams('missing'));

    expect(response.status).toBe(404);
  });
});

describe('DELETE /api/vts/[id]', () => {
  it('deletes the VT', async () => {
    (prisma.visitaTecnica.delete as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const response = await DELETE(new Request('http://localhost/api/vts/vt-1'), makeParams('vt-1'));
    const body = await response.json();

    expect(prisma.visitaTecnica.delete).toHaveBeenCalledWith({ where: { id: 'vt-1' } });
    expect(body).toEqual({ ok: true });
  });

  it('returns 404 when the VT does not exist', async () => {
    (prisma.visitaTecnica.delete as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('not found'));

    const response = await DELETE(new Request('http://localhost/api/vts/missing'), makeParams('missing'));

    expect(response.status).toBe(404);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
npx vitest run "src/app/api/vts/[id]/route.test.ts"
```
Esperado: FAIL — `./route` não existe ainda.

- [ ] **Step 3: Implementar a rota**

Criar `src/app/api/vts/[id]/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface UpdateVTBody {
  event?: string;
  date?: string;
  responsible?: string;
  companion?: string;
  rooms?: string[];
  clientRequests?: string;
  specialNotes?: string;
  status?: 'pending' | 'completed';
  notified?: boolean;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json()) as UpdateVTBody;

  const data: Record<string, unknown> = { ...body };
  if (body.date) {
    data.date = new Date(body.date);
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const vt = await tx.visitaTecnica.update({ where: { id }, data });

      if (body.notified === true) {
        await tx.notification.create({
          data: {
            text: `Visita Técnica para "${vt.event}" está se aproximando! Início às ${vt.date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.`,
          },
        });
      }

      return vt;
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Erro ao atualizar VT', error);
    return NextResponse.json({ error: 'Visita Técnica não encontrada' }, { status: 404 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    await prisma.visitaTecnica.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Erro ao excluir VT', error);
    return NextResponse.json({ error: 'Visita Técnica não encontrada' }, { status: 404 });
  }
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```bash
npx vitest run "src/app/api/vts/[id]/route.test.ts"
```
Esperado: PASS (6 testes).

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/vts/[id]/route.ts" "src/app/api/vts/[id]/route.test.ts"
git commit -m "feat: add /api/vts/[id] route for update and delete"
```

---

### Task 4: Rota /api/rooms (GET, POST)

**Files:**
- Create: `src/app/api/rooms/route.ts`
- Test: `src/app/api/rooms/route.test.ts`

**Interfaces:**
- Consumes: `prisma` de `@/lib/prisma` (Task 1).
- Produces: `GET` (retorna `string[]` de nomes de salas), `POST` (recebe `{ name }`, responde com o `Room` criado/existente, status 201).

- [ ] **Step 1: Escrever o teste falho**

Criar `src/app/api/rooms/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '@/lib/prisma';
import { GET, POST } from './route';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    room: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/rooms', () => {
  it('returns room names ordered by creation', async () => {
    (prisma.room.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: '1', name: 'Palco Principal' },
      { id: '2', name: 'Camarins A/B' },
    ]);

    const response = await GET();
    const body = await response.json();

    expect(prisma.room.findMany).toHaveBeenCalledWith({ orderBy: { createdAt: 'asc' } });
    expect(body).toEqual(['Palco Principal', 'Camarins A/B']);
  });
});

describe('POST /api/rooms', () => {
  it('returns 400 when name is missing', async () => {
    const request = new Request('http://localhost/api/rooms', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(prisma.room.upsert).not.toHaveBeenCalled();
  });

  it('upserts the room by name', async () => {
    const room = { id: '1', name: 'Sala Nova' };
    (prisma.room.upsert as ReturnType<typeof vi.fn>).mockResolvedValue(room);

    const request = new Request('http://localhost/api/rooms', {
      method: 'POST',
      body: JSON.stringify({ name: 'Sala Nova' }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(prisma.room.upsert).toHaveBeenCalledWith({
      where: { name: 'Sala Nova' },
      update: {},
      create: { name: 'Sala Nova' },
    });
    expect(response.status).toBe(201);
    expect(body).toEqual(room);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
npx vitest run src/app/api/rooms/route.test.ts
```
Esperado: FAIL — `./route` não existe ainda.

- [ ] **Step 3: Implementar a rota**

Criar `src/app/api/rooms/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const rooms = await prisma.room.findMany({ orderBy: { createdAt: 'asc' } });
  return NextResponse.json(rooms.map((room) => room.name));
}

export async function POST(request: Request) {
  const body = (await request.json()) as { name?: string };
  const name = body.name?.trim();

  if (!name) {
    return NextResponse.json({ error: 'name é obrigatório' }, { status: 400 });
  }

  const room = await prisma.room.upsert({
    where: { name },
    update: {},
    create: { name },
  });

  return NextResponse.json(room, { status: 201 });
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```bash
npx vitest run src/app/api/rooms/route.test.ts
```
Esperado: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/rooms/route.ts src/app/api/rooms/route.test.ts
git commit -m "feat: add /api/rooms route"
```

---

### Task 5: Rota /api/notifications (GET, PATCH, DELETE)

**Files:**
- Create: `src/app/api/notifications/route.ts`
- Test: `src/app/api/notifications/route.test.ts`

**Interfaces:**
- Consumes: `prisma` de `@/lib/prisma` (Task 1).
- Produces: `GET` (lista notificações mais recentes primeiro), `PATCH` (marca todas como lidas, retorna lista atualizada), `DELETE` (limpa todas, retorna `{ ok: true }`).

- [ ] **Step 1: Escrever o teste falho**

Criar `src/app/api/notifications/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '@/lib/prisma';
import { GET, PATCH, DELETE } from './route';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    notification: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/notifications', () => {
  it('returns notifications ordered by newest first', async () => {
    const notifications = [{ id: '1', text: 'Teste', read: false }];
    (prisma.notification.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(notifications);

    const response = await GET();
    const body = await response.json();

    expect(prisma.notification.findMany).toHaveBeenCalledWith({ orderBy: { createdAt: 'desc' } });
    expect(body).toEqual(notifications);
  });
});

describe('PATCH /api/notifications', () => {
  it('marks all notifications as read and returns the updated list', async () => {
    const notifications = [{ id: '1', text: 'Teste', read: true }];
    (prisma.notification.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(notifications);

    const response = await PATCH();
    const body = await response.json();

    expect(prisma.notification.updateMany).toHaveBeenCalledWith({ data: { read: true } });
    expect(body).toEqual(notifications);
  });
});

describe('DELETE /api/notifications', () => {
  it('clears all notifications', async () => {
    const response = await DELETE();
    const body = await response.json();

    expect(prisma.notification.deleteMany).toHaveBeenCalledWith({});
    expect(body).toEqual({ ok: true });
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
npx vitest run src/app/api/notifications/route.test.ts
```
Esperado: FAIL — `./route` não existe ainda.

- [ ] **Step 3: Implementar a rota**

Criar `src/app/api/notifications/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const notifications = await prisma.notification.findMany({ orderBy: { createdAt: 'desc' } });
  return NextResponse.json(notifications);
}

export async function PATCH() {
  await prisma.notification.updateMany({ data: { read: true } });
  const notifications = await prisma.notification.findMany({ orderBy: { createdAt: 'desc' } });
  return NextResponse.json(notifications);
}

export async function DELETE() {
  await prisma.notification.deleteMany({});
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```bash
npx vitest run src/app/api/notifications/route.test.ts
```
Esperado: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/notifications/route.ts src/app/api/notifications/route.test.ts
git commit -m "feat: add /api/notifications route"
```

---

### Task 6: Rota /api/briefings (GET)

**Files:**
- Create: `src/app/api/briefings/route.ts`
- Test: `src/app/api/briefings/route.test.ts`

**Interfaces:**
- Consumes: `prisma` de `@/lib/prisma` (Task 1).
- Produces: `GET` (lista briefings mais recentes primeiro).

- [ ] **Step 1: Escrever o teste falho**

Criar `src/app/api/briefings/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '@/lib/prisma';
import { GET } from './route';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    briefing: {
      findMany: vi.fn(),
    },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/briefings', () => {
  it('returns briefings ordered by newest first', async () => {
    const briefings = [{ id: '1', to: 'a@arena.com.br', subject: 'x', body: 'y' }];
    (prisma.briefing.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(briefings);

    const response = await GET();
    const body = await response.json();

    expect(prisma.briefing.findMany).toHaveBeenCalledWith({ orderBy: { createdAt: 'desc' } });
    expect(body).toEqual(briefings);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
npx vitest run src/app/api/briefings/route.test.ts
```
Esperado: FAIL — `./route` não existe ainda.

- [ ] **Step 3: Implementar a rota**

Criar `src/app/api/briefings/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const briefings = await prisma.briefing.findMany({ orderBy: { createdAt: 'desc' } });
  return NextResponse.json(briefings);
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```bash
npx vitest run src/app/api/briefings/route.test.ts
```
Esperado: PASS (1 teste).

- [ ] **Step 5: Rodar toda a suíte de testes**

```bash
npx vitest run
```
Esperado: PASS (todos os testes das Tasks 2-6, sem nenhum arquivo falhando).

- [ ] **Step 6: Commit**

```bash
git add src/app/api/briefings/route.ts src/app/api/briefings/route.test.ts
git commit -m "feat: add /api/briefings route"
```

---

### Task 7: Conectar ao Supabase, rodar migration e seed

**Files:**
- Create: `.env.local` (não commitado — já coberto por `.env*.local` no `.gitignore`)

**Interfaces:**
- Consumes: `DATABASE_URL` fornecida pelo usuário (connection string do Supabase, modo *pooling*, ex: porta 6543 com `?pgbouncer=true`).
- Produces: banco Postgres no Supabase com as tabelas `visitas_tecnicas`, `rooms`, `notifications`, `briefings` criadas e populadas com os dados de seed.

Esta task exige uma credencial que só o usuário tem. Se `DATABASE_URL` ainda não foi fornecida, pare aqui e peça ao usuário a connection string do projeto Supabase (Project Settings → Database → Connection string → modo "Transaction" / pooling) antes de continuar.

- [ ] **Step 1: Configurar a variável de ambiente local**

Criar `.env.local` na raiz do projeto com o valor real fornecido pelo usuário:

```
DATABASE_URL="<connection string fornecida pelo usuário>"
```

- [ ] **Step 2: Rodar a migration inicial**

```bash
npx prisma migrate dev --name init
```
Esperado: Prisma cria as tabelas `visitas_tecnicas`, `rooms`, `notifications`, `briefings` no Supabase e confirma `Your database is now in sync with your schema`.

- [ ] **Step 3: Rodar o seed**

```bash
npx prisma db seed
```
Esperado: script roda sem erro, populando as 8 salas padrão e as 6 VTs de exemplo (mesmos dados que hoje ficam hardcoded em `VTDashboard.tsx`).

- [ ] **Step 4: Verificar os dados no Supabase**

No painel do Supabase (Table Editor), confirmar que as tabelas `rooms` e `visitas_tecnicas` têm, respectivamente, 8 e 6 linhas.

- [ ] **Step 5: Commit**

Nenhum arquivo de código muda nesta task (`.env.local` não é commitado). Não é necessário commit — apenas confirmar que a migration ficou registrada:

```bash
git status
```
Esperado: `prisma/migrations/` aparece como novo diretório (a migration gerada pelo Prisma é código e deve ser versionada).

```bash
git add prisma/migrations
git commit -m "chore: add initial Prisma migration"
```

---

### Task 8: Integração no client (VTDashboard.tsx) + verificação manual end-to-end

**Files:**
- Modify: `src/components/VTDashboard.tsx`
- Modify: `src/components/ScheduleVTModal.tsx`

**Interfaces:**
- Consumes: `/api/vts`, `/api/rooms`, `/api/notifications`, `/api/briefings` (Tasks 2-6), já servindo dados reais do Supabase (Task 7).

- [ ] **Step 1: Ajustar `ScheduleVTModal.tsx` para o formato de data vindo da API**

A API retorna `date` como ISO completo (`2026-08-10T14:30:00.000Z`), enquanto o `<input type="datetime-local">` exige `YYYY-MM-DDTHH:mm`. Em `src/components/ScheduleVTModal.tsx`, dentro do `useEffect` que sincroniza os campos ao editar, trocar:

```ts
setDate(editingVT.date || '');
```

por:

```ts
setDate(editingVT.date ? editingVT.date.slice(0, 16) : '');
```

- [ ] **Step 2: Reescrever `VTDashboard.tsx` para consumir a API em vez do localStorage**

Substituir o conteúdo de `src/components/VTDashboard.tsx` por:

```tsx
"use client";

import React, { useState, useEffect } from 'react';
import { VTCard } from './VTCard';
import { ScheduleVTModal } from './ScheduleVTModal';

interface VT {
  id: string;
  event: string;
  date: string;
  responsible: string;
  companion: string;
  rooms: string[];
  clientRequests: string;
  specialNotes: string;
  status: 'pending' | 'completed';
  notified?: boolean;
}

interface Notification {
  id: string;
  text: string;
  read: boolean;
  createdAt: string;
}

interface BriefingEmail {
  id: string;
  to: string;
  subject: string;
  body: string;
  createdAt: string;
}

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

export default function VTDashboard() {
  const [vts, setVts] = useState<VT[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVT, setEditingVT] = useState<VT | null>(null);

  const [availableRooms, setAvailableRooms] = useState<string[]>([]);

  const [statusFilter, setStatusFilter] = useState<'all' | 'today' | 'pending' | 'completed'>('all');
  const [roomFilter, setRoomFilter] = useState<string>('all');
  const [showRoomDashboard, setShowRoomDashboard] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [briefings, setBriefings] = useState<BriefingEmail[]>([]);
  const [isBriefingOpen, setIsBriefingOpen] = useState(false);

  // Carrega os dados iniciais da API
  useEffect(() => {
    (async () => {
      try {
        const [vtsRes, roomsRes, notifsRes, briefsRes] = await Promise.all([
          fetch('/api/vts'),
          fetch('/api/rooms'),
          fetch('/api/notifications'),
          fetch('/api/briefings'),
        ]);
        setVts(await vtsRes.json());
        setAvailableRooms(await roomsRes.json());
        setNotifications(await notifsRes.json());
        setBriefings(await briefsRes.json());
      } catch (e) {
        console.error('Erro ao carregar dados do servidor', e);
        alert('Não foi possível carregar os dados. Verifique sua conexão e recarregue a página.');
      }
    })();
  }, []);

  const handleAddCustomRoom = async (newRoom: string) => {
    try {
      const response = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newRoom }),
      });
      if (!response.ok) throw new Error('Falha ao adicionar sala');
      setAvailableRooms(prev => (prev.includes(newRoom) ? prev : [...prev, newRoom]));
    } catch (e) {
      console.error(e);
      alert('Não foi possível adicionar a sala.');
    }
  };

  // Cronómetro de Notificação em Tempo Real (Roda a cada 10 segundos)
  useEffect(() => {
    const interval = setInterval(async () => {
      const now = new Date();

      for (const vt of vts) {
        if (vt.notified || vt.status === 'completed' || !vt.date) continue;

        const vtTime = new Date(vt.date).getTime();
        const diffMs = vtTime - now.getTime();

        if (diffMs > 0 && diffMs <= 3 * 60 * 60 * 1000) {
          try {
            const response = await fetch(`/api/vts/${vt.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ notified: true }),
            });
            if (!response.ok) throw new Error('Falha ao marcar VT como notificada');
            const updatedVT = await response.json();

            setVts(prev => prev.map(v => (v.id === updatedVT.id ? updatedVT : v)));

            const notifsRes = await fetch('/api/notifications');
            setNotifications(await notifsRes.json());
          } catch (e) {
            console.error(e);
          }
        }
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [vts]);

  // Cálculos das Métricas
  const totalCount = vts.length;

  const todayCount = vts.filter(vt => {
    if (!vt.date) return false;
    const vtDate = new Date(vt.date).toDateString();
    const today = new Date().toDateString();
    return vtDate === today && vt.status !== 'completed';
  }).length;

  const upcomingCount = vts.filter(vt => {
    if (!vt.date) return false;
    const diff = new Date(vt.date).getTime() - new Date().getTime();
    return diff > 0 && diff <= 7 * 24 * 60 * 60 * 1000 && vt.status !== 'completed';
  }).length;

  const mappedRoomsCount = new Set(vts.flatMap(vt => vt.rooms || [])).size;

  // Filtragem da Grid
  const filteredVTs = vts.filter(vt => {
    const matchesSearch = (vt.event || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (vt.responsible || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (vt.companion || '').toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (roomFilter !== 'all' && !(vt.rooms || []).includes(roomFilter)) return false;

    if (!vt.date && statusFilter !== 'all') return false;
    const vtDate = vt.date ? new Date(vt.date).toDateString() : '';
    const today = new Date().toDateString();

    if (statusFilter === 'today') return vtDate === today && vt.status !== 'completed';
    if (statusFilter === 'pending') return vtDate !== today && vt.status === 'pending';
    if (statusFilter === 'completed') return vt.status === 'completed';

    return true;
  });

  const unreadNotifsCount = notifications.filter(n => !n.read).length;

  const markAllNotifsRead = async () => {
    try {
      const response = await fetch('/api/notifications', { method: 'PATCH' });
      if (!response.ok) throw new Error('Falha ao marcar notificações como lidas');
      setNotifications(await response.json());
    } catch (e) {
      console.error(e);
      alert('Não foi possível atualizar as notificações.');
    }
  };

  const clearNotifications = async () => {
    try {
      const response = await fetch('/api/notifications', { method: 'DELETE' });
      if (!response.ok) throw new Error('Falha ao limpar notificações');
      setNotifications([]);
    } catch (e) {
      console.error(e);
      alert('Não foi possível limpar as notificações.');
    }
  };

  const handleComplete = async (id: string) => {
    try {
      const response = await fetch(`/api/vts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      });
      if (!response.ok) throw new Error('Falha ao concluir VT');
      const updatedVT = await response.json();
      setVts(prev => prev.map(v => (v.id === updatedVT.id ? updatedVT : v)));
    } catch (e) {
      console.error(e);
      alert('Não foi possível concluir a Visita Técnica.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta Visita Técnica?')) return;
    try {
      const response = await fetch(`/api/vts/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Falha ao excluir VT');
      setVts(prev => prev.filter(v => v.id !== id));
    } catch (e) {
      console.error(e);
      alert('Não foi possível excluir a Visita Técnica.');
    }
  };

  const handleSave = async (data: Omit<VT, 'id' | 'status'> & { id?: string }) => {
    try {
      if (data.id) {
        const response = await fetch(`/api/vts/${data.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error('Falha ao editar VT');
        const updatedVT = await response.json();
        setVts(prev => prev.map(v => (v.id === updatedVT.id ? updatedVT : v)));
      } else {
        const response = await fetch('/api/vts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error('Falha ao criar VT');
        const newVT = await response.json();
        setVts(prev => [...prev, newVT]);

        const [notifsRes, briefsRes] = await Promise.all([
          fetch('/api/notifications'),
          fetch('/api/briefings'),
        ]);
        setNotifications(await notifsRes.json());
        setBriefings(await briefsRes.json());
      }
      setIsModalOpen(false);
    } catch (e) {
      console.error(e);
      alert('Não foi possível salvar a Visita Técnica.');
    }
  };

  return (
    <div className="bg-[#090b11] text-white p-6 rounded-2xl border border-[#1d2433] max-w-7xl mx-auto flex flex-col gap-6 relative">
      <header className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="font-extrabold text-lg tracking-wider">GESTÃO DE VISITAS TÉCNICAS</h2>
          <p className="text-xs text-slate-400">Gerenciamento e registro de solicitações e salas de visitas técnicas da Arena</p>
        </div>

        <div className="flex items-center gap-3 relative">

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setIsNotifOpen(!isNotifOpen);
                setIsBriefingOpen(false);
              }}
              className="w-10 h-10 rounded-lg border border-[#1d2433] hover:border-slate-600 bg-[#121620] hover:bg-[#1b2130] flex items-center justify-center text-[#9ca3af] hover:text-white transition-all cursor-pointer relative"
            >
              <span className="material-symbols-outlined text-[20px]">notifications</span>
              {unreadNotifsCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#ff1a3c] text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center animate-pulse border-2 border-[#121620]">
                  {unreadNotifsCount}
                </span>
              )}
            </button>

            {isNotifOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-[#121620] border border-[#1d2433] rounded-xl shadow-[0_10px_25px_rgba(0,0,0,0.5)] z-[999] overflow-hidden">
                <div className="p-3 border-b border-[#1d2433] flex justify-between items-center bg-[#0e1119]">
                  <span className="font-bold text-xs">Notificações</span>
                  <div className="flex gap-2">
                    <button onClick={markAllNotifsRead} className="text-[9px] text-[#00e5ff] hover:underline">Ler todas</button>
                    <button onClick={clearNotifications} className="text-[9px] text-[#ff1a3c] hover:underline">Limpar</button>
                  </div>
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-500 italic">Sem novas notificações</div>
                  ) : (
                    notifications.map(n => (
                      <div
                        key={n.id}
                        className={`p-3 border-b border-[#1d2433]/50 text-xs transition-all hover:bg-white/5 flex flex-col gap-1 ${!n.read ? 'bg-[#ff1a3c]/5 border-l-2 border-l-[#ff1a3c]' : ''}`}
                      >
                        <span className="text-[#f3f4f6]">{n.text}</span>
                        <span className="text-[9px] text-slate-500">{formatTime(n.createdAt)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              setIsBriefingOpen(true);
              setIsNotifOpen(false);
            }}
            className="flex items-center gap-1.5 bg-[#121620] hover:bg-[#1b2130] border border-[#1d2433] hover:border-slate-600 px-4 py-2 rounded-lg text-xs font-semibold text-[#9ca3af] hover:text-white transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">mail</span>
            <span>Briefings Enviados</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setEditingVT(null);
              setIsModalOpen(true);
              setIsNotifOpen(false);
              setIsBriefingOpen(false);
            }}
            className="flex items-center gap-1.5 bg-[#ff1a3c] hover:bg-[#ff4760] px-4 py-2 rounded-lg text-xs font-semibold transition-all shadow-[0_4px_14px_rgba(255,26,60,0.35)] hover:-translate-y-0.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            <span>Agendar VT</span>
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div
          onClick={() => {
            setStatusFilter('all');
            setRoomFilter('all');
            setShowRoomDashboard(false);
          }}
          className={`bg-[#121620] border p-4 rounded-xl cursor-pointer transition-all hover:-translate-y-0.5 ${
            statusFilter === 'all' && roomFilter === 'all' && !showRoomDashboard ? 'border-[#ff1a3c]' : 'border-[#1d2433]'
          }`}
        >
          <span className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-wider block mb-1">Total de VTs</span>
          <span className="font-extrabold text-2xl font-title">{totalCount}</span>
        </div>

        <div
          onClick={() => {
            setStatusFilter('today');
            setRoomFilter('all');
            setShowRoomDashboard(false);
          }}
          className={`bg-[#121620] border p-4 rounded-xl cursor-pointer transition-all hover:-translate-y-0.5 ${
            statusFilter === 'today' ? 'border-[#ff1a3c]' : 'border-[#1d2433]'
          }`}
        >
          <span className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-wider block mb-1">VTs para Hoje</span>
          <span className={`font-extrabold text-2xl font-title ${todayCount > 0 ? 'text-[#ff1a3c]' : ''}`}>{todayCount}</span>
        </div>

        <div
          onClick={() => {
            setStatusFilter('pending');
            setRoomFilter('all');
            setShowRoomDashboard(false);
          }}
          className={`bg-[#121620] border p-4 rounded-xl cursor-pointer transition-all hover:-translate-y-0.5 ${
            statusFilter === 'pending' ? 'border-[#ff1a3c]' : 'border-[#1d2433]'
          }`}
        >
          <span className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-wider block mb-1">Próximos Dias</span>
          <span className="font-extrabold text-2xl font-title">{upcomingCount}</span>
        </div>

        <div
          onClick={() => {
            setShowRoomDashboard(!showRoomDashboard);
            setStatusFilter('all');
          }}
          className={`bg-[#121620] border p-4 rounded-xl cursor-pointer transition-all hover:-translate-y-0.5 ${
            showRoomDashboard ? 'border-[#00e5ff] bg-[#00e5ff]/5' : 'border-[#1d2433]'
          }`}
        >
          <span className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-wider block mb-1">Salas Mapeadas</span>
          <span className="font-extrabold text-2xl font-title text-[#00e5ff]">{mappedRoomsCount}</span>
        </div>
      </div>

      {showRoomDashboard && (
        <div className="bg-[#121620] border border-[#1d2433] p-5 rounded-xl animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-[#f3f4f6] font-bold text-xs uppercase flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-[#00e5ff]">dashboard</span>
              <span>Espaços Mapeados e VTs Agendadas (O que é cada um)</span>
            </h2>
            <button
              type="button"
              onClick={() => setRoomFilter('all')}
              className="text-[10px] bg-[#1d2433] hover:bg-[#2e3952] px-2.5 py-1 rounded transition-all text-[#9ca3af] hover:text-white cursor-pointer"
            >
              Limpar Filtro de Sala
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(availableRooms || []).map(room => {
              const roomVTs = vts.filter(v => (v.rooms || []).includes(room));
              return (
                <div
                  key={room}
                  onClick={() => setRoomFilter(room)}
                  className={`p-3.5 rounded-lg cursor-pointer border transition-all ${
                    roomFilter === room ? 'border-[#00e5ff] bg-[#00e5ff]/5' : 'border-[#1d2433] bg-[#090b11]/50 hover:border-[#2e3952]'
                  }`}
                >
                  <div className="flex justify-between items-center font-bold text-xs text-[#f3f4f6] mb-2">
                    <span>{room}</span>
                    <span className="bg-[#00e5ff]/10 text-[#00e5ff] px-2 py-0.5 rounded-full text-[10px]">{roomVTs.length}</span>
                  </div>
                  <div className="border-t border-[#1d2433]/60 pt-2 flex flex-col gap-1">
                    {roomVTs.length > 0 ? roomVTs.map(vt => (
                      <div key={vt.id} className="text-[11px] text-[#9ca3af] truncate flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#ff1a3c]" />
                        <span>{vt.event || 'Sem Evento'}</span>
                      </div>
                    )) : (
                      <span className="text-[10px] text-slate-600 italic">Sem eventos agendados</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex gap-4 items-center">
        <input
          type="text"
          placeholder="Buscar por evento ou técnico..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full max-w-sm bg-[#121620] border border-[#1d2433] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#ff1a3c] transition-all"
        />
        {roomFilter !== 'all' && (
          <div className="flex items-center gap-1.5 bg-[#00e5ff]/10 text-[#00e5ff] border border-[#00e5ff]/20 px-3 py-1.5 rounded-lg text-xs font-semibold">
            <span>Sala: {roomFilter}</span>
            <button onClick={() => setRoomFilter('all')} className="font-extrabold hover:text-[#ff1a3c] cursor-pointer">×</button>
          </div>
        )}
        {statusFilter !== 'all' && (
          <div className="flex items-center gap-1.5 bg-[#ff1a3c]/10 text-[#ff1a3c] border border-[#ff1a3c]/20 px-3 py-1.5 rounded-lg text-xs font-semibold">
            <span>Filtro: {statusFilter === 'today' ? 'Hoje' : statusFilter === 'pending' ? 'Pendentes' : 'Concluídas'}</span>
            <button onClick={() => setStatusFilter('all')} className="font-extrabold hover:text-white cursor-pointer">×</button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {filteredVTs.map(vt => (
          <VTCard
            key={vt.id}
            vt={vt}
            onComplete={handleComplete}
            onEdit={(vtToEdit) => {
              setEditingVT(vtToEdit);
              setIsModalOpen(true);
            }}
            onDelete={handleDelete}
          />
        ))}
      </div>

      {filteredVTs.length === 0 && (
        <div className="text-center py-12 border border-dashed border-[#1d2433] rounded-xl text-xs text-slate-500 font-medium">
          Nenhuma Visita Técnica corresponde aos filtros ativos.
        </div>
      )}

      <ScheduleVTModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        editingVT={editingVT}
        availableRooms={availableRooms}
        onAddCustomRoom={handleAddCustomRoom}
        onSave={handleSave}
      />

      {isBriefingOpen && (
        <>
          <div
            onClick={() => setIsBriefingOpen(false)}
            className="fixed inset-0 bg-[#03050c]/70 backdrop-blur-sm z-[1000]"
          />
          <div className="fixed right-0 top-0 h-full w-[90%] max-w-[450px] bg-[#121620] border-l border-[#1d2433] shadow-[0_0_40px_rgba(0,0,0,0.5)] z-[1001] flex flex-col p-6 animate-in slide-in-from-right duration-300 text-left">
            <div className="flex justify-between items-center border-b border-[#1d2433] pb-4 mb-6 bg-[#121620]">
              <h3 className="font-bold text-sm uppercase flex items-center gap-2">
                <span className="material-symbols-outlined text-[#00e5ff]">mail</span>
                <span>Briefings e Notificações de Email</span>
              </h3>
              <button
                onClick={() => setIsBriefingOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-white/5 text-[#9ca3af] hover:text-white flex items-center justify-center cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="flex-grow overflow-y-auto flex flex-col gap-4">
              {briefings.length === 0 ? (
                <div className="text-center text-xs text-slate-500 italic py-12">Nenhum briefing enviado ainda. Crie uma nova visita técnica para simular o disparo de briefings técnicos.</div>
              ) : (
                briefings.map(mail => (
                  <div key={mail.id} className="bg-[#090b11] border border-[#1d2433] p-4 rounded-xl flex flex-col gap-3">
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-[10px] text-[#00e5ff] font-bold font-mono">ENVIADO</span>
                      <span className="text-[9px] text-slate-500">{formatTime(mail.createdAt)}</span>
                    </div>
                    <div className="text-xs">
                      <div className="text-slate-400 mb-0.5"><strong className="text-slate-300">Para:</strong> {mail.to}</div>
                      <div className="text-slate-400 mb-2"><strong className="text-slate-300">Assunto:</strong> {mail.subject}</div>
                      <div className="bg-[#121620] border border-[#1d2433]/40 p-2.5 rounded text-[11px] text-[#9ca3af] leading-relaxed whitespace-pre-line font-mono">
                        {mail.body}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Rodar a suíte de testes de API (garante que nada quebrou nas rotas)**

```bash
npx vitest run
```
Esperado: PASS (todos os testes das Tasks 2-6).

- [ ] **Step 4: Verificação manual end-to-end**

```bash
npm run dev
```

Com o servidor rodando (`http://localhost:3000`), no navegador:
1. A grade carrega as 6 VTs seedadas na Task 7 (sem tela em branco, sem erro no console).
2. Clicar em "Agendar VT", preencher o formulário e salvar → a VT aparece na grade, o sino de notificações mostra 1 não lida, e o painel "Briefings Enviados" mostra o novo briefing.
3. Editar essa VT (botão "Editar") → o campo de data vem preenchido corretamente (sem erro de formato) e a alteração persiste após recarregar a página (F5).
4. Clicar em "Concluir" numa VT → o status muda para "Concluída" e permanece assim após recarregar a página.
5. Excluir uma VT → ela some da grade e não reaparece após recarregar.
6. No modal de agendamento, adicionar uma sala customizada nova → ela aparece na lista de salas e persiste após recarregar a página.
7. Abrir o painel "Salas Mapeadas" → confirma que as VTs aparecem agrupadas corretamente por sala.

- [ ] **Step 5: Commit**

```bash
git add src/components/VTDashboard.tsx src/components/ScheduleVTModal.tsx
git commit -m "feat: wire VTDashboard to Postgres API instead of localStorage"
```
