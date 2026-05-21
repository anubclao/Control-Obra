import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options';
import { prisma } from '@/lib/db';
import { invalidateFinancialReportCache } from '@/lib/financial-report';
import { ROLES_CAN_CONFIGURE_TAXES, DEFAULT_TAXES_COLOMBIA } from '@/lib/constants';

// POST - Inicializar impuestos predeterminados para un proyecto
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
    const { projectId } = body;

    if (!projectId) {
      return NextResponse.json({ error: 'Falta projectId' }, { status: 400 });
    }

    // Verificar que el proyecto existe
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });
    }

    // Verificar si ya existen impuestos para el proyecto
    const existingTaxes = await prisma.taxConfig.count({ where: { projectId } });
    if (existingTaxes > 0) {
      return NextResponse.json(
        { error: 'Ya existen impuestos configurados para este proyecto' },
        { status: 400 }
      );
    }

    // Crear impuestos predeterminados
    const createdTaxes = await Promise.all(
      DEFAULT_TAXES_COLOMBIA.map(tax =>
        prisma.taxConfig.create({
          data: {
            projectId,
            name: tax.name,
            rate: tax.rate,
            type: tax.type,
            appliesTo: tax.appliesTo
          }
        })
      )
    );

    await invalidateFinancialReportCache();

    return NextResponse.json({
      message: 'Impuestos inicializados correctamente',
      taxes: createdTaxes
    }, { status: 201 });
  } catch (error) {
    console.error('Error initializing taxes:', error);
    return NextResponse.json({ error: 'Error al inicializar impuestos' }, { status: 500 });
  }
}
