import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options';
import { prisma } from '@/lib/db';
import { ROLES_CAN_CREATE_PROGRESS } from '@/lib/constants';

type UserRole = keyof typeof import('@/lib/constants').USER_ROLE;
const ROLES_WITH_GLOBAL_ITEM_ACCESS = ['ADMIN', 'GERENTE', 'DIRECTOR'] as const;

export const dynamic = 'force-dynamic';

// PUT - Approve or reject a progress entry (Admin only)
export async function PUT(
  request: Request,
  { params }: { params: { entryId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const userRole = (session.user as any).role as UserRole;

    const body = await request.json();
    const { action, quantityToday, notes, contractorId } = body; // approve/reject or edit payload

    const entry = await prisma.progressEntry.findUnique({
      where: { id: params.entryId },
      include: {
        budgetItem: true,
        dailyProgress: {
          select: {
            projectId: true,
          },
        },
      }
    });

    if (!entry) {
      return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 });
    }

    // Flujo de aprobación/rechazo para admin/gerencia/director
    if (action !== undefined) {
      if (!['ADMIN', 'GERENTE', 'DIRECTOR'].includes(userRole)) {
        return NextResponse.json(
          { error: 'Solo administradores pueden aprobar registros' },
          { status: 403 }
        );
      }

      if (!['approve', 'reject'].includes(action)) {
        return NextResponse.json(
          { error: 'Acción no válida. Use "approve" o "reject"' },
          { status: 400 }
        );
      }

      if (entry.status !== 'PENDING_APPROVAL') {
        return NextResponse.json(
          { error: 'Este registro no está pendiente de aprobación' },
          { status: 400 }
        );
      }

      const updated = await prisma.progressEntry.update({
        where: { id: params.entryId },
        data: {
          status: action === 'approve' ? 'APPROVED' : 'REJECTED',
          approvedById: session.user.id,
          approvedAt: new Date()
        },
        include: {
          budgetItem: {
            select: {
              id: true,
              itemNumber: true,
              description: true,
              unit: true,
              quantity: true
            }
          },
          contractor: {
            select: { id: true, name: true }
          }
        }
      });

      await prisma.progressEntryAudit.create({
        data: {
          progressEntryId: entry.id,
          projectId: entry.dailyProgress.projectId,
          budgetItemId: entry.budgetItemId,
          actorUserId: session.user.id,
          action: action === 'approve' ? 'APPROVE' : 'REJECT',
          oldStatus: entry.status,
          newStatus: updated.status,
        },
      });

      return NextResponse.json(updated);
    }

    // Flujo de edición por ítem
    if (!ROLES_CAN_CREATE_PROGRESS.includes(userRole as (typeof ROLES_CAN_CREATE_PROGRESS)[number])) {
      return NextResponse.json({ error: 'Sin permisos para editar avance' }, { status: 403 });
    }

    const hasGlobalAccess = ROLES_WITH_GLOBAL_ITEM_ACCESS.includes(userRole as (typeof ROLES_WITH_GLOBAL_ITEM_ACCESS)[number]);
    if (!hasGlobalAccess) {
      const projectId = entry.dailyProgress.projectId;
      const userId = session.user.id;

      const projectAssignment = await prisma.projectAssignment.findFirst({
        where: {
          userId,
          projectId,
        },
        select: { id: true },
      });

      if (!projectAssignment) {
        return NextResponse.json(
          { error: 'No tienes asignacion activa para este proyecto.' },
          { status: 403 }
        );
      }

      const allowedItem = await prisma.budgetItemAssignment.findFirst({
        where: {
          userId,
          projectId,
          budgetItemId: entry.budgetItemId,
        },
        select: { id: true },
      });

      if (!allowedItem) {
        return NextResponse.json(
          { error: 'No tienes permiso para modificar este item de presupuesto.' },
          { status: 403 }
        );
      }
    }

    const quantity = parseFloat(String(quantityToday));
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return NextResponse.json(
        { error: 'La cantidad debe ser mayor a cero' },
        { status: 400 }
      );
    }

    const exceedsQuantity = quantity > (entry.budgetItem.quantity ?? 0);
    const nextStatus = exceedsQuantity ? 'PENDING_APPROVAL' : 'APPROVED';

    if (entry.status !== 'PENDING_APPROVAL') {
      // Para edición de registros ya aprobados/rechazados, recalculamos estado.
    }

    const updated = await prisma.progressEntry.update({
      where: { id: params.entryId },
      data: {
        quantityToday: quantity,
        notes: notes ?? null,
        contractorId: contractorId ?? entry.contractorId,
        exceedsQuantity,
        status: nextStatus,
        approvedById: nextStatus === 'PENDING_APPROVAL' ? null : session.user.id,
        approvedAt: nextStatus === 'PENDING_APPROVAL' ? null : new Date()
      },
      include: {
        budgetItem: {
          select: {
            id: true,
            itemNumber: true,
            description: true,
            unit: true,
            quantity: true
          }
        },
        contractor: {
          select: { id: true, name: true }
        }
      }
    });

    await prisma.progressEntryAudit.create({
      data: {
        progressEntryId: entry.id,
        projectId: entry.dailyProgress.projectId,
        budgetItemId: entry.budgetItemId,
        actorUserId: session.user.id,
        action: 'EDIT',
        oldQuantity: entry.quantityToday,
        newQuantity: updated.quantityToday,
        oldNotes: entry.notes || null,
        newNotes: updated.notes || null,
        oldStatus: entry.status,
        newStatus: updated.status,
        oldContractorId: entry.contractorId || null,
        newContractorId: updated.contractorId || null,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating progress entry:', error);
    return NextResponse.json(
      { error: 'Error al actualizar registro de avance' },
      { status: 500 }
    );
  }
}
