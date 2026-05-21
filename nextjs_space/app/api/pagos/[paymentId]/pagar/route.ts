import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options';
import { prisma } from '@/lib/db';
import { invalidateFinancialReportCache } from '@/lib/financial-report';
import { ROLES_CAN_MARK_PAID } from '@/lib/constants';

// POST - Marcar solicitud como pagada
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const userRole = session.user.role;
    if (!ROLES_CAN_MARK_PAID.includes(userRole as any)) {
      return NextResponse.json({ error: 'Sin permisos para marcar como pagado' }, { status: 403 });
    }

    const { paymentId } = await params;
    const body = await request.json();
    const { notes } = body;

    const payment = await prisma.paymentRequest.findUnique({ where: { id: paymentId } });
    if (!payment) {
      return NextResponse.json({ error: 'Solicitud de pago no encontrada' }, { status: 404 });
    }

    // Solo se puede pagar si está completamente aprobada
    if (payment.status !== 'APPROVED') {
      return NextResponse.json(
        { error: 'Solo se pueden pagar solicitudes completamente aprobadas' },
        { status: 400 }
      );
    }

    // Actualizar solicitud
    const updatedPayment = await prisma.paymentRequest.update({
      where: { id: paymentId },
      data: {
        status: 'PAID',
        paidAt: new Date(),
        notes: notes ? `${payment.notes || ''}\n\nNota de pago: ${notes}` : payment.notes
      },
      include: {
        project: { select: { id: true, name: true, code: true } },
        contractor: { select: { id: true, name: true, nit: true } },
        approvals: {
          include: {
            approver: { select: { id: true, name: true, email: true, role: true } }
          },
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    await invalidateFinancialReportCache();

    return NextResponse.json(updatedPayment);
  } catch (error) {
    console.error('Error marking payment as paid:', error);
    return NextResponse.json({ error: 'Error al marcar como pagado' }, { status: 500 });
  }
}
