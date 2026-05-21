import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options';
import { prisma } from '@/lib/db';
import { ROLES_CAN_VIEW_FINANCIAL, ROLES_CAN_CREATE_PAYMENTS } from '@/lib/constants';

// GET - Obtener una solicitud de pago por ID
export async function GET(
  request: NextRequest,
  { params }: { params: { paymentId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const userRole = session.user.role;
    if (!ROLES_CAN_VIEW_FINANCIAL.includes(userRole as any)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const { paymentId } = params;

    const payment = await prisma.paymentRequest.findUnique({
      where: { id: paymentId },
      include: {
        project: { select: { id: true, name: true, code: true, client: true } },
        contractor: { select: { id: true, name: true, nit: true, email: true, phone: true } },
        workCut: { 
          select: { 
            id: true, 
            cutNumber: true, 
            requestedAmount: true,
            periodStart: true,
            periodEnd: true 
          } 
        },
        contract: { 
          select: { 
            id: true, 
            contractNumber: true, 
            contractValue: true,
            contractType: true 
          } 
        },
        createdBy: { select: { id: true, name: true, email: true, role: true } },
        approvals: {
          include: {
            approver: { select: { id: true, name: true, email: true, role: true } }
          },
          orderBy: { createdAt: 'asc' }
        },
        documents: true
      }
    });

    if (!payment) {
      return NextResponse.json({ error: 'Solicitud de pago no encontrada' }, { status: 404 });
    }

    return NextResponse.json(payment);
  } catch (error) {
    console.error('Error fetching payment:', error);
    return NextResponse.json({ error: 'Error al obtener solicitud de pago' }, { status: 500 });
  }
}

// PUT - Actualizar solicitud de pago
export async function PUT(
  request: NextRequest,
  { params }: { params: { paymentId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const userRole = session.user.role;
    if (!ROLES_CAN_CREATE_PAYMENTS.includes(userRole as any)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const { paymentId } = params;
    const body = await request.json();

    const payment = await prisma.paymentRequest.findUnique({ where: { id: paymentId } });
    if (!payment) {
      return NextResponse.json({ error: 'Solicitud de pago no encontrada' }, { status: 404 });
    }

    // Solo se puede editar si está pendiente
    if (payment.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Solo se pueden editar solicitudes pendientes' },
        { status: 400 }
      );
    }

    const updatedPayment = await prisma.paymentRequest.update({
      where: { id: paymentId },
      data: {
        concept: body.concept,
        amount: body.amount ? parseFloat(body.amount) : undefined,
        paymentType: body.paymentType,
        priority: body.priority,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        beneficiaryName: body.beneficiaryName,
        beneficiaryNit: body.beneficiaryNit,
        bankName: body.bankName,
        accountType: body.accountType,
        accountNumber: body.accountNumber,
        notes: body.notes,
        requiredApprovalLevel: body.requiredApprovalLevel
      },
      include: {
        project: { select: { id: true, name: true, code: true } },
        contractor: { select: { id: true, name: true, nit: true } },
        createdBy: { select: { id: true, name: true, email: true } }
      }
    });

    return NextResponse.json(updatedPayment);
  } catch (error) {
    console.error('Error updating payment:', error);
    return NextResponse.json({ error: 'Error al actualizar solicitud de pago' }, { status: 500 });
  }
}

// DELETE - Cancelar solicitud de pago
export async function DELETE(
  request: NextRequest,
  { params }: { params: { paymentId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const userRole = session.user.role;
    if (!['ADMIN', 'GERENTE'].includes(userRole)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const { paymentId } = params;

    const payment = await prisma.paymentRequest.findUnique({ where: { id: paymentId } });
    if (!payment) {
      return NextResponse.json({ error: 'Solicitud de pago no encontrada' }, { status: 404 });
    }

    // No se puede cancelar si ya está pagada
    if (payment.status === 'PAID') {
      return NextResponse.json(
        { error: 'No se puede cancelar una solicitud ya pagada' },
        { status: 400 }
      );
    }

    await prisma.paymentRequest.update({
      where: { id: paymentId },
      data: { status: 'CANCELLED' }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error cancelling payment:', error);
    return NextResponse.json({ error: 'Error al cancelar solicitud de pago' }, { status: 500 });
  }
}
