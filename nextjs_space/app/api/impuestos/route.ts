import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import type { Prisma } from '@prisma/client';
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options';
import { prisma } from '@/lib/db';
import { invalidateFinancialReportCache } from '@/lib/financial-report';
import { ROLES_CAN_CONFIGURE_TAXES, ROLES_CAN_VIEW_FINANCIAL } from '@/lib/constants';

// GET - Listar configuraciones de impuestos
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

    const where: Prisma.TaxConfigWhereInput = {};
    if (projectId) where.projectId = projectId;

    const taxes = await prisma.taxConfig.findMany({
      where,
      include: {
        project: { select: { id: true, name: true, code: true } }
      },
      orderBy: [{ projectId: 'asc' }, { name: 'asc' }]
    });

    return NextResponse.json(taxes);
  } catch (error) {
    console.error('Error fetching taxes:', error);
    return NextResponse.json({ error: 'Error al obtener impuestos' }, { status: 500 });
  }
}

// POST - Crear configuración de impuesto
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const userRole = session.user.role;
    if (!ROLES_CAN_CONFIGURE_TAXES.includes(userRole as (typeof ROLES_CAN_CONFIGURE_TAXES)[number])) {
      return NextResponse.json({ error: 'Sin permisos para configurar impuestos' }, { status: 403 });
    }

    const body = await request.json();
    const { projectId, name, rate, type, appliesTo } = body;

    // Validaciones
    if (!projectId || !name || rate === undefined || !type || !appliesTo) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: projectId, name, rate, type, appliesTo' },
        { status: 400 }
      );
    }

    // Verificar que el proyecto existe
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });
    }

    // Verificar que no exista un impuesto con el mismo nombre para el proyecto
    const existingTax = await prisma.taxConfig.findUnique({
      where: { projectId_name: { projectId, name } }
    });
    if (existingTax) {
      return NextResponse.json(
        { error: 'Ya existe un impuesto con ese nombre para este proyecto' },
        { status: 400 }
      );
    }

    // Crear impuesto
    const tax = await prisma.taxConfig.create({
      data: {
        projectId,
        name,
        rate: parseFloat(rate),
        type,
        appliesTo
      },
      include: {
        project: { select: { id: true, name: true, code: true } }
      }
    });

    await invalidateFinancialReportCache();

    return NextResponse.json(tax, { status: 201 });
  } catch (error) {
    console.error('Error creating tax:', error);
    return NextResponse.json({ error: 'Error al crear impuesto' }, { status: 500 });
  }
}
