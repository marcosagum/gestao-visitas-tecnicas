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

  it('returns 500 error when database connection fails', async () => {
    (prisma.briefing.findMany as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('connection lost'));

    const response = await GET();

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({ error: 'Erro ao buscar os briefings' });
  });
});
