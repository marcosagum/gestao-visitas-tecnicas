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
