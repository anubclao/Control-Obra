import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

// PUT - Editar entrada de avance del contratista
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ contractId: string; entryId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { contractId, entryId } = await params;
    const body = await request.json();
    const { action, quantityToday, notes } = body;

    const entry = await prisma.contractorProgressEntry.findUnique({
      where: { id: entryId },
      include: {
        dailyProgress: {
          select: { contractId: true }
        },
        budgetItem: true
      }
    });

    if (!entry || entry.dailyProgress.contractId !== contractId) {
      return NextResponse.json(
        { error: 'Entrada no encontrada' },
        { status: 404 }
      );
    }

    // Flujo de aprobación/rechazo
    if (action !== undefined) {
      if (!['ADMIN', 'GERENTE', 'DIRECTOR'].includes((session.user as any).role)) {
        return NextResponse.json(
          { error: 'Solo administradores pueden aprobar' },
          { status: 403 }
        );
      }

      if (!['approve', 'reject'].includes(action)) {
        return NextResponse.json(
          { error: 'Acción no válida' },
          { status: 400 }
        );
      }

      const updated = await prisma.contractorProgressEntry.update({
        where: { id: entryId },
        data: {
          status: action === 'approve' ? 'APPROVED' : 'REJECTED',
          approvedById: session.user.id,
          approvedAt: new Date()
        },
        include: {
          budgetItem: true
        }
      });

      return NextResponse.json(updated);
    }

    // Edición de cantidad y notas
    const quantity = parseFloat(String(quantityToday));
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return NextResponse.json(
        { error: 'La cantidad debe ser mayor a cero' },
        { status: 400 }
      );
    }

    const exceedsQuantity = quantity > (entry.budgetItem.quantity ?? 0);
    const nextStatus = exceedsQuantity ? 'PENDING_APPROVAL' : 'APPROVED';

    const updated = await prisma.contractorProgressEntry.update({
      where: { id: entryId },
      data: {
        quantityToday: quantity,
        notes: notes ?? null,
        exceedsQuantity,
        status: nextStatus,
        approvedById: nextStatus === 'PENDING_APPROVAL' ? null : session.user.id,
        approvedAt: nextStatus === 'PENDING_APPROVAL' ? null : new Date()
      },
      include: {
        budgetItem: true
      }
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating contractor progress entry:', error);
    return NextResponse.json(
      { error: 'Error al actualizar entrada' },
      { status: 500 }
    );
  }
}

// DELETE - Eliminar entrada de avance
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ contractId: string; entryId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { contractId, entryId } = await params;

    const entry = await prisma.contractorProgressEntry.findUnique({
      where: { id: entryId },
      include: {
        dailyProgress: {
          select: { contractId: true }
        }
      }
    });

    if (!entry || entry.dailyProgress.contractId !== contractId) {
      return NextResponse.json(
        { error: 'Entrada no encontrada' },
        { status: 404 }
      );
    }

    await prisma.contractorProgressEntry.delete({
      where: { id: entryId }
    });

    return NextResponse.json({ message: 'Entrada eliminada' });
  } catch (error) {
    console.error('Error deleting contractor progress entry:', error);
    return NextResponse.json(
      { error: 'Error al eliminar entrada' },
      { status: 500 }
    );
  }
}
