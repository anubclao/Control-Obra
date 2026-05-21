import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options';
import { prisma } from '@/lib/db';
import { invalidateFinancialReportCache } from '@/lib/financial-report';
import { ROLES_CAN_CONFIGURE_TAXES, ROLES_CAN_VIEW_FINANCIAL } from '@/lib/constants';

// GET - Obtener un impuesto por ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const userRole = session.user.role;
    if (!ROLES_CAN_VIEW_FINANCIAL.includes(userRole as (typeof ROLES_CAN_VIEW_FINANCIAL)[number])) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const { id } = await params;

    const tax = await prisma.taxConfig.findUnique({
      where: { id },
      include: {
        project: { select: { id: true, name: true, code: true } }
      }
    });

    if (!tax) {
      return NextResponse.json({ error: 'Impuesto no encontrado' }, { status: 404 });
    }

    return NextResponse.json(tax);
  } catch (error) {
    console.error('Error fetching tax:', error);
    return NextResponse.json({ error: 'Error al obtener impuesto' }, { status: 500 });
  }
}

// PUT - Actualizar impuesto
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const userRole = session.user.role;
    if (!ROLES_CAN_CONFIGURE_TAXES.includes(userRole as (typeof ROLES_CAN_CONFIGURE_TAXES)[number])) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    const tax = await prisma.taxConfig.findUnique({ where: { id } });
    if (!tax) {
      return NextResponse.json({ error: 'Impuesto no encontrado' }, { status: 404 });
    }

    const updatedTax = await prisma.taxConfig.update({
      where: { id },
      data: {
        name: body.name,
        rate: body.rate !== undefined ? parseFloat(body.rate) : undefined,
        type: body.type,
        appliesTo: body.appliesTo,
        isActive: body.isActive
      },
      include: {
        project: { select: { id: true, name: true, code: true } }
      }
    });

    await invalidateFinancialReportCache();

    return NextResponse.json(updatedTax);
  } catch (error) {
    console.error('Error updating tax:', error);
    return NextResponse.json({ error: 'Error al actualizar impuesto' }, { status: 500 });
  }
}

// DELETE - Eliminar impuesto
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const userRole = session.user.role;
    if (!ROLES_CAN_CONFIGURE_TAXES.includes(userRole as (typeof ROLES_CAN_CONFIGURE_TAXES)[number])) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const { id } = await params;

    const tax = await prisma.taxConfig.findUnique({ where: { id } });
    if (!tax) {
      return NextResponse.json({ error: 'Impuesto no encontrado' }, { status: 404 });
    }

    await prisma.taxConfig.delete({ where: { id } });

    await invalidateFinancialReportCache();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting tax:', error);
    return NextResponse.json({ error: 'Error al eliminar impuesto' }, { status: 500 });
  }
}
