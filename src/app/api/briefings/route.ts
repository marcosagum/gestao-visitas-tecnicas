import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const briefings = await prisma.briefing.findMany({ orderBy: { createdAt: 'desc' } });
    return NextResponse.json(briefings);
  } catch (error) {
    console.error('Erro ao buscar briefings', error);
    return NextResponse.json({ error: 'Erro ao buscar os briefings' }, { status: 500 });
  }
}
