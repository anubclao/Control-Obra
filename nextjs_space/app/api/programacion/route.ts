import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options';
import { prisma } from '@/lib/db';
import { ROLES_CAN_CREATE_PROGRESS, ROLES_CAN_VIEW_PROGRESS } from '@/lib/constants';

type UserRole = keyof typeof import('@/lib/constants').USER_ROLE;
const ROLES_WITH_GLOBAL_ITEM_ACCESS = ['ADMIN', 'GERENTE', 'DIRECTOR'] as const;

// GET - Listar registros de avance (por proyecto y/o rango de fechas)
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const userRole = session.user.role as UserRole;
    if (!ROLES_CAN_VIEW_PROGRESS.includes(userRole as (typeof ROLES_CAN_VIEW_PROGRESS)[number])) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const whereClause: Record<string, unknown> = {};
    
    if (projectId) {
      whereClause.projectId = projectId;
    }
    
    if (startDate || endDate) {
      whereClause.date = {};
      if (startDate) {
        (whereClause.date as Record<string, unknown>).gte = new Date(startDate);
      }
      if (endDate) {
        (whereClause.date as Record<string, unknown>).lte = new Date(endDate);
      }
    }

    const dailyProgress = await prisma.dailyProgress.findMany({
      where: whereClause,
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
              select: {
                id: true,
                itemNumber: true,
                description: true,
                unit: true,
                quantity: true
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
      },
      orderBy: {
        date: 'desc'
      }
    });

    return NextResponse.json(dailyProgress);
  } catch (error) {
    console.error('Error fetching daily progress:', error);
    return NextResponse.json(
      { error: 'Error al obtener registros de avance' },
      { status: 500 }
    );
  }
}

// POST - Crear nuevo registro de avance diario
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const userRole = session.user.role as UserRole;
    if (!ROLES_CAN_CREATE_PROGRESS.includes(userRole as (typeof ROLES_CAN_CREATE_PROGRESS)[number])) {
      return NextResponse.json({ error: 'Sin permisos para registrar avance' }, { status: 403 });
    }

    const body = await request.json();
    const {
      projectId,
      date,
      weather,
      temperature,
      generalNotes,
      personnelCount,
      entries // Array de { budgetItemId, quantityToday, notes, contractorId }
    } = body;

    // Validar campos requeridos
    if (!projectId || !date) {
      return NextResponse.json(
        { error: 'Proyecto y fecha son requeridos' },
        { status: 400 }
      );
    }

    if (!Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json(
        { error: 'Debe registrar al menos una actividad para crear el avance diario' },
        { status: 400 }
      );
    }

    // Verificar que el proyecto existe
    const project = await prisma.project.findUnique({
      where: { id: projectId }
    });

    if (!project) {
      return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });
    }

    const userId = (session.user as any).id as string;
    const hasGlobalAccess = ROLES_WITH_GLOBAL_ITEM_ACCESS.includes(userRole as (typeof ROLES_WITH_GLOBAL_ITEM_ACCESS)[number]);

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

      const requestedItemIds = Array.isArray(entries)
        ? entries.map((entry: { budgetItemId: string }) => entry.budgetItemId).filter(Boolean)
        : [];

      if (requestedItemIds.length > 0) {
        const allowedAssignments = await prisma.budgetItemAssignment.findMany({
          where: {
            userId,
            projectId,
          },
          select: { budgetItemId: true },
        });

        if (allowedAssignments.length === 0) {
          return NextResponse.json(
            { error: 'No tienes actividades/items de presupuesto asignados para registrar avance.' },
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

    // Validar que la fecha sea hoy (en zona horaria de Colombia UTC-5)
    const now = new Date();
    // Convertir a hora Colombia (UTC-5)
    const colombiaOffset = -5 * 60; // minutos
    const colombiaTime = new Date(now.getTime() + (colombiaOffset - now.getTimezoneOffset()) * 60 * 1000);
    const todayStr = colombiaTime.toISOString().split('T')[0];
    
    if (date !== todayStr) {
      return NextResponse.json(
        { error: 'Solo se permite registrar avance para el día de hoy' },
        { status: 400 }
      );
    }

    // Crear el registro de avance con sus entradas
    const dailyProgress = await prisma.dailyProgress.create({
      data: {
        projectId,
        date: new Date(date),
        weather: weather || null,
        temperature: temperature ? parseFloat(temperature) : null,
        generalNotes: generalNotes || null,
        personnelCount: personnelCount ? parseInt(personnelCount) : 0,
        createdById: session.user.id,
        entries: entries && entries.length > 0 ? {
          create: entries.map((entry: { budgetItemId: string; quantityToday: number; notes?: string; contractorId?: string; exceedsQuantity?: boolean }) => ({
            budgetItemId: entry.budgetItemId,
            quantityToday: parseFloat(String(entry.quantityToday)),
            notes: entry.notes || null,
            contractorId: entry.contractorId || null,
            exceedsQuantity: entry.exceedsQuantity || false,
            status: entry.exceedsQuantity ? 'PENDING_APPROVAL' : 'APPROVED'
          }))
        } : undefined
      },
      include: {
        project: {
          select: {
            id: true,
            name: true
          }
        },
        entries: {
          include: {
            budgetItem: true
          }
        }
      }
    });

    if (dailyProgress.entries?.length > 0) {
      await prisma.progressEntryAudit.createMany({
        data: dailyProgress.entries.map((entry: { id: string; budgetItemId: string; quantityToday: number; notes?: string | null; status: string; contractorId?: string | null }) => ({
          progressEntryId: entry.id,
          projectId,
          budgetItemId: entry.budgetItemId,
          actorUserId: userId,
          action: 'CREATE',
          newQuantity: entry.quantityToday,
          newNotes: entry.notes || null,
          newStatus: entry.status,
          newContractorId: entry.contractorId || null,
        })),
      });
    }

    return NextResponse.json(dailyProgress, { status: 201 });
  } catch (error) {
    console.error('Error creating daily progress:', error);
    return NextResponse.json(
      { error: 'Error al crear registro de avance' },
      { status: 500 }
    );
  }
}
