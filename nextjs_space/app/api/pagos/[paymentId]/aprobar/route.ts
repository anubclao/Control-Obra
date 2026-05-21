import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options';
import { prisma } from '@/lib/db';
import { invalidateFinancialReportCache } from '@/lib/financial-report';
import { APPROVAL_LEVELS } from '@/lib/constants';

// POST - Aprobar solicitud de pago
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { paymentId } = await params;
    const body = await request.json();
    const { comments } = body;

    // Obtener usuario y pago
    const user = await prisma.user.findUnique({ where: { email: session.user.email! } });
    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    const payment = await prisma.paymentRequest.findUnique({
      where: { id: paymentId },
      include: { approvals: true }
    });

    if (!payment) {
      return NextResponse.json({ error: 'Solicitud de pago no encontrada' }, { status: 404 });
    }

    // Verificar estado válido para aprobar
    if (!['PENDING', 'APPROVED_LEVEL_1', 'APPROVED_LEVEL_2'].includes(payment.status)) {
      return NextResponse.json(
        { error: 'Esta solicitud no puede ser aprobada en su estado actual' },
        { status: 400 }
      );
    }

    // Determinar nivel de aprobación actual
    const currentLevel = payment.currentApprovalLevel;
    const levelConfig = APPROVAL_LEVELS[currentLevel as keyof typeof APPROVAL_LEVELS];

    if (!levelConfig) {
      return NextResponse.json(
        { error: 'Nivel de aprobación inválido' },
        { status: 400 }
      );
    }

    // Verificar si el usuario puede aprobar este nivel
    if (!levelConfig.roles.includes(user.role as any)) {
      return NextResponse.json(
        { error: `No tienes permisos para aprobar en el nivel ${currentLevel}` },
        { status: 403 }
      );
    }

    // Verificar si ya aprobó en este nivel
    const alreadyApproved = payment.approvals.some(
      (a: { approverId: string; level: number; action: string }) => 
        a.approverId === user.id && a.level === currentLevel && a.action === 'APPROVED'
    );
    if (alreadyApproved) {
      return NextResponse.json(
        { error: 'Ya has aprobado esta solicitud en este nivel' },
        { status: 400 }
      );
    }

    // Crear registro de aprobación
    await prisma.paymentApproval.create({
      data: {
        paymentRequestId: payment.id,
        approverId: user.id,
        level: currentLevel,
        action: 'APPROVED',
        comments: comments || null
      }
    });

    // Determinar nuevo estado y nivel
    let newStatus = payment.status;
    let newLevel = currentLevel;

    if (currentLevel < payment.requiredApprovalLevel) {
      // Avanzar al siguiente nivel
      newLevel = currentLevel + 1;
      newStatus = `APPROVED_LEVEL_${currentLevel}` as any;
    } else {
      // Aprobación completa
      newStatus = 'APPROVED';
    }

    // Actualizar solicitud
    const updatedPayment = await prisma.paymentRequest.update({
      where: { id: paymentId },
      data: {
        status: newStatus,
        currentApprovalLevel: newLevel
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
    console.error('Error approving payment:', error);
    return NextResponse.json({ error: 'Error al aprobar solicitud de pago' }, { status: 500 });
  }
}
