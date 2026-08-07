import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
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
    (prisma.visitaTecnica.update as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Record not found', { code: 'P2025', clientVersion: '7.9.1' })
    );

    const request = new Request('http://localhost/api/vts/missing', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'completed' }),
    });

    const response = await PATCH(request, makeParams('missing'));

    expect(response.status).toBe(404);
  });

  it('returns 500 for errors other than record-not-found', async () => {
    (prisma.visitaTecnica.update as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('connection lost'));

    const request = new Request('http://localhost/api/vts/vt-1', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'completed' }),
    });

    const response = await PATCH(request, makeParams('vt-1'));

    expect(response.status).toBe(500);
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
    (prisma.visitaTecnica.delete as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Record not found', { code: 'P2025', clientVersion: '7.9.1' })
    );

    const response = await DELETE(new Request('http://localhost/api/vts/missing'), makeParams('missing'));

    expect(response.status).toBe(404);
  });

  it('returns 500 for errors other than record-not-found', async () => {
    (prisma.visitaTecnica.delete as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('connection lost'));

    const response = await DELETE(new Request('http://localhost/api/vts/vt-1'), makeParams('vt-1'));

    expect(response.status).toBe(500);
  });
});
