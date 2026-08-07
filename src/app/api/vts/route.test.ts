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

  it('returns 500 when the database call fails', async () => {
    (prisma.visitaTecnica.findMany as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('connection lost'));

    const response = await GET();

    expect(response.status).toBe(500);
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
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('stores the exact instant from a full ISO date string, independent of server timezone', async () => {
    const createdVT = {
      id: 'vt-1',
      event: 'Show Teste',
      date: new Date('2026-08-10T17:30:00.000Z'),
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
        date: '2026-08-10T14:30:00.000-03:00',
        responsible: 'Marcos Agum',
        companion: 'Roberto',
        rooms: ['Palco Principal'],
        clientRequests: 'Som',
        specialNotes: 'Nenhuma',
      }),
    });

    await POST(request);

    const call = (prisma.visitaTecnica.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.data.date.toISOString()).toBe('2026-08-10T17:30:00.000Z');
  });
});
