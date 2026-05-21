import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options';
import { prisma } from '@/lib/db';

type UserRole = keyof typeof import('@/lib/constants').USER_ROLE;

export const dynamic = 'force-dynamic';

// PUT - Cambiar presupuesto activo
export async function PUT(
  request: Request,
  { params }: { params: { contractId: string; budgetId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const userRole = (session.user as any).role as UserRole;
    if (!['ADMIN', 'GERENTE', 'DIRECTOR'].includes(userRole)) {
      return NextResponse.json(
        { error: 'Sin permisos para cambiar presupuesto activo' },
        { status: 403 }
      );
    }

    // Desactivar todos los presupuestos del contrato
    await prisma.contractorBudget.updateMany({
      where: { contractId: params.contractId },
      data: { isActive: false }
    });

    // Activar el presupuesto seleccionado
    const activatedBudget = await prisma.contractorBudget.update({
      where: { id: params.budgetId },
      data: { isActive: true },
      include: {
        layers: {
          include: {
            items: {
              include: {
                progressEntries: {
                  where: { status: 'APPROVED' },
                  select: { quantityToday: true, status: true }
                }
              }
            }
          },
          orderBy: { order: 'asc' }
        }
      }
    });

    return NextResponse.json({
      message: `Presupuesto v${activatedBudget.versionNumber} activado exitosamente`,
      budget: activatedBudget
    });
  } catch (error) {
    console.error('Error activating budget:', error);
    return NextResponse.json(
      { error: 'Error al activar presupuesto' },
      { status: 500 }
    );
  }
}
