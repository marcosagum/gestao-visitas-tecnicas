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

  it('returns 500 when the database call fails', async () => {
    (prisma.room.findMany as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('connection lost'));

    const response = await GET();

    expect(response.status).toBe(500);
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

  it('returns 500 when the database call fails', async () => {
    (prisma.room.upsert as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('connection lost'));

    const request = new Request('http://localhost/api/rooms', {
      method: 'POST',
      body: JSON.stringify({ name: 'Sala Nova' }),
    });

    const response = await POST(request);

    expect(response.status).toBe(500);
  });
});
