import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options';
import { prisma } from '@/lib/db';
import { ROLES_CAN_MANAGE_HR } from '@/lib/constants';

type UserRole = keyof typeof import('@/lib/constants').USER_ROLE;

// POST - Subir documento de empleado
export async function POST(
  request: Request,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const userRole = session.user.role as UserRole;
    if (!ROLES_CAN_MANAGE_HR.includes(userRole as (typeof ROLES_CAN_MANAGE_HR)[number])) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const { employeeId } = await params;
    const body = await request.json();
    
    const {
      type,
      fileName,
      cloudStoragePath,
      isPublic,
      expirationDate,
      notes
    } = body;

    // Validar campos requeridos
    if (!type || !fileName || !cloudStoragePath) {
      return NextResponse.json(
        { error: 'Tipo, nombre de archivo y ruta de almacenamiento son requeridos' },
        { status: 400 }
      );
    }

    // Verificar que el empleado existe
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId }
    });

    if (!employee) {
      return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
    }

    // Eliminar documento anterior del mismo tipo (excepto OTROS)
    if (type !== 'OTROS') {
      await prisma.employeeDocument.deleteMany({
        where: {
          employeeId,
          type
        }
      });
    }

    // Crear el documento
    const document = await prisma.employeeDocument.create({
      data: {
        type,
        fileName,
        cloudStoragePath,
        isPublic: isPublic || false,
        expirationDate: expirationDate ? new Date(expirationDate) : null,
        notes: notes || null,
        employeeId
      }
    });

    return NextResponse.json(document, { status: 201 });
  } catch (error) {
    console.error('Error uploading employee document:', error);
    return NextResponse.json(
      { error: 'Error al subir documento' },
      { status: 500 }
    );
  }
}
