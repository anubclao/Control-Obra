import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET - Obtener un avance diario específico
export async function GET(
  request: Request,
  { params }: { params: Promise<{ contractId: string; progressId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { contractId, progressId } = await params;

    const dailyProgress = await prisma.contractorDailyProgress.findUnique({
      where: { id: progressId },
      include: {
        contract: {
          select: { id: true, contractNumber: true }
        },
        createdBy: {
          select: { id: true, name: true, email: true }
        },
        entries: {
          include: {
            budgetItem: {
              include: { layer: true }
            },
            approvedBy: {
              select: { name: true }
            }
          }
        }
      }
    });

    if (!dailyProgress || dailyProgress.contract.id !== contractId) {
      return NextResponse.json(
        { error: 'Registro no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json(dailyProgress);
  } catch (error) {
    console.error('Error fetching contractor daily progress:', error);
    return NextResponse.json(
      { error: 'Error al obtener registro' },
      { status: 500 }
    );
  }
}

// PUT - Actualizar avance diario
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ contractId: string; progressId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { contractId, progressId } = await params;
    const body = await request.json();
    const { weather, temperature, generalNotes, personnelCount, entries } = body;

    const existingProgress = await prisma.contractorDailyProgress.findUnique({
      where: { id: progressId },
      select: { contractId: true }
    });

    if (!existingProgress || existingProgress.contractId !== contractId) {
      return NextResponse.json(
        { error: 'Registro no encontrado' },
        { status: 404 }
      );
    }

    const updated = await prisma.contractorDailyProgress.update({
      where: { id: progressId },
      data: {
        weather: weather !== undefined ? weather : undefined,
        temperature: temperature !== undefined ? parseFloat(temperature) : undefined,
        generalNotes: generalNotes !== undefined ? generalNotes : undefined,
        personnelCount: personnelCount !== undefined ? parseInt(personnelCount) : undefined
      },
      include: {
        entries: {
          include: { budgetItem: true }
        }
      }
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating contractor daily progress:', error);
    return NextResponse.json(
      { error: 'Error al actualizar registro' },
      { status: 500 }
    );
  }
}

// DELETE - Eliminar avance diario
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ contractId: string; progressId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { contractId, progressId } = await params;

    const existingProgress = await prisma.contractorDailyProgress.findUnique({
      where: { id: progressId },
      select: { contractId: true }
    });

    if (!existingProgress || existingProgress.contractId !== contractId) {
      return NextResponse.json(
        { error: 'Registro no encontrado' },
        { status: 404 }
      );
    }

    await prisma.contractorDailyProgress.delete({
      where: { id: progressId }
    });

    return NextResponse.json({ message: 'Registro eliminado' });
  } catch (error) {
    console.error('Error deleting contractor daily progress:', error);
    return NextResponse.json(
      { error: 'Error al eliminar registro' },
      { status: 500 }
    );
  }
}
