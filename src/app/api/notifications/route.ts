import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const notifications = await prisma.notification.findMany({ orderBy: { createdAt: 'desc' } });
    return NextResponse.json(notifications);
  } catch (error) {
    console.error('Erro ao buscar notificações', error);
    return NextResponse.json({ error: 'Erro ao buscar as notificações' }, { status: 500 });
  }
}

export async function PATCH() {
  try {
    await prisma.notification.updateMany({ data: { read: true } });
    const notifications = await prisma.notification.findMany({ orderBy: { createdAt: 'desc' } });
    return NextResponse.json(notifications);
  } catch (error) {
    console.error('Erro ao marcar notificações como lidas', error);
    return NextResponse.json({ error: 'Erro ao marcar notificações como lidas' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await prisma.notification.deleteMany({});
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Erro ao limpar notificações', error);
    return NextResponse.json({ error: 'Erro ao limpar as notificações' }, { status: 500 });
  }
}
