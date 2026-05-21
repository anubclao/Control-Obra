import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options';
import { prisma } from '@/lib/db';

type UserRole = keyof typeof import('@/lib/constants').USER_ROLE;

export const dynamic = 'force-dynamic';

// GET - Obtener historial de presupuestos del contratista
export async function GET(
  request: Request,
  { params }: { params: { contractId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const budgets = await prisma.contractorBudget.findMany({
      where: { contractId: params.contractId },
      include: {
        contract: {
          select: {
            id: true,
            contractNumber: true,
            contractor: {
              select: { id: true, name: true }
            }
          }
        },
        layers: {
          include: {
            items: {
              include: {
                progressEntries: {
                  where: {
                    status: 'APPROVED',
                  },
                  select: {
                    quantityToday: true,
                    status: true,
                  },
                },
              },
            },
          },
          orderBy: { order: 'asc' }
        }
      },
      orderBy: [
        { isActive: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    if (budgets.length === 0) {
      return NextResponse.json({
        message: 'No hay presupuestos cargados',
        budgets: []
      });
    }

    return NextResponse.json({
      total: budgets.length,
      budgets,
      activeVersion: budgets.find(b => b.isActive) || budgets[0]
    });
  } catch (error) {
    console.error('Error fetching contractor budgets history:', error);
    return NextResponse.json(
      { error: 'Error al obtener historial de presupuestos' },
      { status: 500 }
    );
  }
}
