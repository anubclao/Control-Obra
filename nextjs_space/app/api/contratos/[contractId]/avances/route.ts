import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options';
import { prisma } from '@/lib/db';

type UserRole = keyof typeof import('@/lib/constants').USER_ROLE;

export const dynamic = 'force-dynamic';

// GET - Listar avances del contratista
export async function GET(
  request: Request,
  { params }: { params: { contractId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const whereClause: Record<string, unknown> = { contractId: params.contractId };

    if (startDate || endDate) {
      whereClause.date = {};
      if (startDate) {
        (whereClause.date as Record<string, unknown>).gte = new Date(startDate);
      }
      if (endDate) {
        (whereClause.date as Record<string, unknown>).lte = new Date(endDate);
      }
    }

    const dailyProgress = await prisma.contractorDailyProgress.findMany({
      where: whereClause,
      include: {
        createdBy: {
          select: { id: true, name: true }
        },
        entries: {
          include: {
            budgetItem: {
              include: { layer: true }
            }
          }
        }
      },
      orderBy: { date: 'desc' }
    });

    return NextResponse.json(dailyProgress);
  } catch (error) {
    console.error('Error fetching contractor daily progress:', error);
    return NextResponse.json(
      { error: 'Error al obtener registros' },
      { status: 500 }
    );
  }
}

// POST - Crear avance diario del contratista
export async function POST(
  request: Request,
  { params }: { params: { contractId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const userRole = (session.user as any).role as UserRole;
    if (!['ADMIN', 'GERENTE', 'DIRECTOR', 'RESIDENTE', 'ENGINEER', 'FIELD_WORKER'].includes(userRole)) {
      return NextResponse.json(
        { error: 'Sin permisos para registrar avance' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { date, weather, temperature, generalNotes, personnelCount, entries } = body;

    // Verificar que el contrato existe
    const contract = await prisma.contract.findUnique({
      where: { id: params.contractId },
      select: { id: true }
    });

    if (!contract) {
      return NextResponse.json(
        { error: 'Contrato no encontrado' },
        { status: 404 }
      );
    }

    if (!Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json(
        { error: 'Debe registrar al menos una actividad' },
        { status: 400 }
      );
    }

    // Crear registro diario con entradas
    const dailyProgress = await prisma.contractorDailyProgress.create({
      data: {
        contractId: params.contractId,
        date: new Date(date),
        weather: weather || null,
        temperature: temperature ? parseFloat(temperature) : null,
        generalNotes: generalNotes || null,
        personnelCount: personnelCount ? parseInt(personnelCount) : 0,
        createdById: session.user.id,
        entries: {
          create: entries.map((entry: { budgetItemId: string; quantityToday: number; notes?: string; exceedsQuantity?: boolean }) => ({
            budgetItemId: entry.budgetItemId,
            quantityToday: parseFloat(String(entry.quantityToday)),
            notes: entry.notes || null,
            exceedsQuantity: entry.exceedsQuantity || false,
            status: entry.exceedsQuantity ? 'PENDING_APPROVAL' : 'APPROVED'
          }))
        }
      },
      include: {
        entries: {
          include: {
            budgetItem: true
          }
        }
      }
    });

    return NextResponse.json(dailyProgress, { status: 201 });
  } catch (error) {
    console.error('Error creating contractor daily progress:', error);
    return NextResponse.json(
      { error: 'Error al crear registro de avance' },
      { status: 500 }
    );
  }
}
