import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options';
import { prisma } from '@/lib/db';
import { ROLES_CAN_CREATE_PROGRESS, ROLES_CAN_VIEW_PROGRESS } from '@/lib/constants';

type UserRole = keyof typeof import('@/lib/constants').USER_ROLE;
const ROLES_WITH_GLOBAL_ITEM_ACCESS = ['ADMIN', 'GERENTE', 'DIRECTOR'] as const;

// GET - Obtener un registro de avance por ID
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const userRole = session.user.role as UserRole;
    if (!ROLES_CAN_VIEW_PROGRESS.includes(userRole as (typeof ROLES_CAN_VIEW_PROGRESS)[number])) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const { id } = await params;

    const dailyProgress = await prisma.dailyProgress.findUnique({
      where: { id },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            code: true
          }
        },
        createdBy: {
          select: {
            id: true,
            name: true
          }
        },
        entries: {
          include: {
            budgetItem: {
              include: {
                layer: true
              }
            },
            contractor: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        photos: true
      }
    });

    if (!dailyProgress) {
      return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 });
    }

    return NextResponse.json(dailyProgress);
  } catch (error) {
    console.error('Error fetching daily progress:', error);
    return NextResponse.json(
      { error: 'Error al obtener registro de avance' },
      { status: 500 }
    );
  }
}

// PUT - Actualizar registro de avance
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const userRole = session.user.role as UserRole;
    if (!ROLES_CAN_CREATE_PROGRESS.includes(userRole as (typeof ROLES_CAN_CREATE_PROGRESS)[number])) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    const {
      weather,
      temperature,
      generalNotes,
      personnelCount,
      entries
    } = body;

    // Verificar que existe
    const existingProgress = await prisma.dailyProgress.findUnique({
      where: { id }
    });

    if (!existingProgress) {
      return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 });
    }

    const userId = (session.user as any).id as string;
    const hasGlobalAccess = ROLES_WITH_GLOBAL_ITEM_ACCESS.includes(userRole as (typeof ROLES_WITH_GLOBAL_ITEM_ACCESS)[number]);
    const projectId = existingProgress.projectId;

    if (!hasGlobalAccess) {
      const projectAssignment = await prisma.projectAssignment.findFirst({
        where: {
          userId,
          projectId,
        },
        select: { id: true },
      });

      if (!projectAssignment) {
        return NextResponse.json(
          { error: 'No tienes asignacion activa para este proyecto.' },
          { status: 403 }
        );
      }

      if (Array.isArray(entries) && entries.length > 0) {
        const requestedItemIds = entries
          .map((entry: { budgetItemId: string }) => entry.budgetItemId)
          .filter(Boolean);

        const allowedAssignments = await prisma.budgetItemAssignment.findMany({
          where: {
            userId,
            projectId,
          },
          select: { budgetItemId: true },
        });

        if (allowedAssignments.length === 0) {
          return NextResponse.json(
            { error: 'No tienes actividades/items de presupuesto asignados para editar avance.' },
            { status: 403 }
          );
        }

        const allowedItemIds = new Set(allowedAssignments.map((a) => a.budgetItemId));
        const forbiddenItem = requestedItemIds.find((id: string) => !allowedItemIds.has(id));

        if (forbiddenItem) {
          return NextResponse.json(
            { error: 'Intentas modificar items fuera de tus actividades asignadas.' },
            { status: 403 }
          );
        }
      }
    }

    // Actualizar el registro
    const dailyProgress = await prisma.dailyProgress.update({
      where: { id },
      data: {
        weather: weather !== undefined ? weather : existingProgress.weather,
        temperature: temperature !== undefined ? parseFloat(temperature) : existingProgress.temperature,
        generalNotes: generalNotes !== undefined ? generalNotes : existingProgress.generalNotes,
        personnelCount: personnelCount !== undefined ? parseInt(personnelCount) : existingProgress.personnelCount
      },
      include: {
        project: true,
        entries: {
          include: {
            budgetItem: true
          }
        }
      }
    });

    // Si se proporcionan entries, actualizar las entradas
    if (entries && Array.isArray(entries)) {
      // Eliminar entradas existentes
      await prisma.progressEntry.deleteMany({
        where: { dailyProgressId: id }
      });

      // Crear nuevas entradas
      if (entries.length > 0) {
        await prisma.progressEntry.createMany({
          data: entries.map((entry: { budgetItemId: string; quantityToday: number; notes?: string; contractorId?: string }) => ({
            dailyProgressId: id,
            budgetItemId: entry.budgetItemId,
            quantityToday: parseFloat(String(entry.quantityToday)),
            notes: entry.notes || null,
            contractorId: entry.contractorId || null
          }))
        });
      }
    }

    // Obtener el registro actualizado con todas las relaciones
    const updatedProgress = await prisma.dailyProgress.findUnique({
      where: { id },
      include: {
        project: true,
        entries: {
          include: {
            budgetItem: true
          }
        },
        photos: true
      }
    });

    return NextResponse.json(updatedProgress);
  } catch (error) {
    console.error('Error updating daily progress:', error);
    return NextResponse.json(
      { error: 'Error al actualizar registro de avance' },
      { status: 500 }
    );
  }
}

// DELETE - Eliminar registro de avance
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const userRole = session.user.role as UserRole;
    if (!ROLES_CAN_CREATE_PROGRESS.includes(userRole as (typeof ROLES_CAN_CREATE_PROGRESS)[number])) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const { id } = await params;

    await prisma.dailyProgress.delete({
      where: { id }
    });

    return NextResponse.json({ message: 'Registro eliminado' });
  } catch (error) {
    console.error('Error deleting daily progress:', error);
    return NextResponse.json(
      { error: 'Error al eliminar registro de avance' },
      { status: 500 }
    );
  }
}
