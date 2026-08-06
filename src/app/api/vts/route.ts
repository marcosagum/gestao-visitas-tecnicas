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
