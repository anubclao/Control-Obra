import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options';
import { prisma } from '@/lib/db';
import { invalidateFinancialReportCache } from '@/lib/financial-report';
import { ROLES_CAN_APPROVE_PAYMENTS } from '@/lib/constants';

// POST - Rechazar solicitud de pago
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
    if (!ROLES_CAN_APPROVE_PAYMENTS.includes(userRole as any)) {
      return NextResponse.json({ error: 'Sin permisos para rechazar solicitudes' }, { status: 403 });
    }

    const { paymentId } = await params;
    const body = await request.json();
    const { reason, comments } = body;

    if (!reason) {
      return NextResponse.json(
        { error: 'Debe proporcionar un motivo de rechazo' },
        { status: 400 }
      );
    }

    // Obtener usuario y pago
    const user = await prisma.user.findUnique({ where: { email: session.user.email! } });
    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    const payment = await prisma.paymentRequest.findUnique({ where: { id: paymentId } });
    if (!payment) {
      return NextResponse.json({ error: 'Solicitud de pago no encontrada' }, { status: 404 });
    }

    // Verificar estado válido para rechazar
    if (['REJECTED', 'PAID', 'CANCELLED'].includes(payment.status)) {
      return NextResponse.json(
        { error: 'Esta solicitud no puede ser rechazada en su estado actual' },
        { status: 400 }
      );
    }

    // Crear registro de rechazo
    await prisma.paymentApproval.create({
      data: {
        paymentRequestId: payment.id,
        approverId: user.id,
        level: payment.currentApprovalLevel,
        action: 'REJECTED',
        comments: comments || reason
      }
    });

    // Actualizar solicitud
    const updatedPayment = await prisma.paymentRequest.update({
      where: { id: paymentId },
      data: {
        status: 'REJECTED',
        rejectionReason: reason
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
    console.error('Error rejecting payment:', error);
    return NextResponse.json({ error: 'Error al rechazar solicitud de pago' }, { status: 500 });
  }
}
