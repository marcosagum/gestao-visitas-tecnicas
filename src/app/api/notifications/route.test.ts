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

  it('returns 500 when the database call fails', async () => {
    (prisma.notification.findMany as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('connection lost'));

    const response = await GET();

    expect(response.status).toBe(500);
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

  it('returns 500 when the database call fails', async () => {
    (prisma.notification.updateMany as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('connection lost'));

    const response = await PATCH();

    expect(response.status).toBe(500);
  });
});

describe('DELETE /api/notifications', () => {
  it('clears all notifications', async () => {
    const response = await DELETE();
    const body = await response.json();

    expect(prisma.notification.deleteMany).toHaveBeenCalledWith({});
    expect(body).toEqual({ ok: true });
  });

  it('returns 500 when the database call fails', async () => {
    (prisma.notification.deleteMany as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('connection lost'));

    const response = await DELETE();

    expect(response.status).toBe(500);
  });
});
