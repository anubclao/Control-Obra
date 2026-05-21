import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import type { Prisma } from '@prisma/client';
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options';
import { prisma } from '@/lib/db';
import { invalidateFinancialReportCache } from '@/lib/financial-report';
import { ROLES_CAN_CREATE_PAYMENTS, ROLES_CAN_VIEW_FINANCIAL } from '@/lib/constants';

// GET - Listar solicitudes de pago
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const userRole = session.user.role;
    if (!ROLES_CAN_VIEW_FINANCIAL.includes(userRole as (typeof ROLES_CAN_VIEW_FINANCIAL)[number])) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');

    const where: Prisma.PaymentRequestWhereInput = {};
    if (projectId) where.projectId = projectId;
    if (status) where.status = status;
    if (priority) where.priority = priority;

    const payments = await prisma.paymentRequest.findMany({
      where,
      include: {
        project: { select: { id: true, name: true, code: true } },
        contractor: { select: { id: true, name: true, nit: true } },
        workCut: { select: { id: true, cutNumber: true } },
        contract: { select: { id: true, contractNumber: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        approvals: {
          include: {
            approver: { select: { id: true, name: true, email: true, role: true } }
          },
          orderBy: { createdAt: 'asc' }
        },
        _count: { select: { documents: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(payments);
  } catch (error) {
    console.error('Error fetching payments:', error);
    return NextResponse.json({ error: 'Error al obtener solicitudes de pago' }, { status: 500 });
  }
}

// POST - Crear solicitud de pago
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const userRole = session.user.role;
    if (!ROLES_CAN_CREATE_PAYMENTS.includes(userRole as (typeof ROLES_CAN_CREATE_PAYMENTS)[number])) {
      return NextResponse.json({ error: 'Sin permisos para crear solicitudes de pago' }, { status: 403 });
    }

    const body = await request.json();
    const {
      projectId,
      concept,
      amount,
      paymentType,
      priority,
      dueDate,
      contractorId,
      workCutId,
      contractId,
      beneficiaryName,
      beneficiaryNit,
      bankName,
      accountType,
      accountNumber,
      notes,
      requiredApprovalLevel
    } = body;

    // Validaciones
    if (!projectId || !concept || !amount) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: projectId, concept, amount' },
        { status: 400 }
      );
    }

    // Verificar que el proyecto existe
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });
    }

    // Generar número de pago
    const year = new Date().getFullYear();
    const count = await prisma.paymentRequest.count({
      where: {
        paymentNumber: { startsWith: `PAG-${year}` }
      }
    });
    const paymentNumber = `PAG-${year}-${String(count + 1).padStart(4, '0')}`;

    // Obtener usuario actual
    const user = await prisma.user.findUnique({ where: { email: session.user.email! } });
    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    // Crear solicitud de pago
    const payment = await prisma.paymentRequest.create({
      data: {
        paymentNumber,
        concept,
        amount: parseFloat(amount),
        paymentType: paymentType || 'CORTE_OBRA',
        priority: priority || 'NORMAL',
        dueDate: dueDate ? new Date(dueDate) : null,
        contractorId: contractorId || null,
        workCutId: workCutId || null,
        contractId: contractId || null,
        beneficiaryName: beneficiaryName || null,
        beneficiaryNit: beneficiaryNit || null,
        bankName: bankName || null,
        accountType: accountType || null,
        accountNumber: accountNumber || null,
        notes: notes || null,
        requiredApprovalLevel: requiredApprovalLevel || 2,
        projectId,
        createdById: user.id
      },
      include: {
        project: { select: { id: true, name: true, code: true } },
        contractor: { select: { id: true, name: true, nit: true } },
        createdBy: { select: { id: true, name: true, email: true } }
      }
    });

    await invalidateFinancialReportCache();

    return NextResponse.json(payment, { status: 201 });
  } catch (error) {
    console.error('Error creating payment:', error);
    return NextResponse.json({ error: 'Error al crear solicitud de pago' }, { status: 500 });
  }
}
