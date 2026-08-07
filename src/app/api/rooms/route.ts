import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const rooms = await prisma.room.findMany({ orderBy: { createdAt: 'asc' } });
    return NextResponse.json(rooms.map((room) => room.name));
  } catch (error) {
    console.error('Erro ao buscar salas', error);
    return NextResponse.json({ error: 'Erro ao buscar as salas' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const body = (await request.json()) as { name?: string };
  const name = body.name?.trim();

  if (!name) {
    return NextResponse.json({ error: 'name é obrigatório' }, { status: 400 });
  }

  try {
    const room = await prisma.room.upsert({
      where: { name },
      update: {},
      create: { name },
    });

    return NextResponse.json(room, { status: 201 });
  } catch (error) {
    console.error('Erro ao adicionar sala', error);
    return NextResponse.json({ error: 'Erro ao adicionar a sala' }, { status: 500 });
  }
}
