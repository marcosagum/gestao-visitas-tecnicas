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
