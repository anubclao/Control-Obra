import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/auth-options";
import { prisma } from "@/lib/db";

const ROLES_CAN_ASSIGN = ["ADMIN", "GERENTE", "DIRECTOR"] as const;

type AssignmentPayload = {
  projectAssignments?: Array<{ projectId: string; role: string }>;
  itemAssignments?: Array<{ projectId: string; budgetItemIds: string[] }>;
};

async function getDirectorProjectIds(userId: string): Promise<string[]> {
  const rows = await prisma.projectAssignment.findMany({
    where: {
      userId,
      role: "DIRECTOR",
    },
    select: { projectId: true },
  });

  return rows.map((r) => r.projectId);
}

function unique<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

// GET - Ver asignaciones de un usuario
export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const role = (session.user as any)?.role;
    if (!ROLES_CAN_ASSIGN.includes(role)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const projectAssignments = await prisma.projectAssignment.findMany({
      where: { userId: params.userId },
      include: {
        project: { select: { id: true, name: true, code: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    const itemAssignments = await prisma.budgetItemAssignment.findMany({
      where: { userId: params.userId },
      include: {
        budgetItem: {
          select: {
            id: true,
            itemNumber: true,
            description: true,
            layer: {
              select: {
                budget: { select: { projectId: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ projectAssignments, itemAssignments });
  } catch (error) {
    console.error("Error fetching assignments:", error);
    return NextResponse.json(
      { error: "Error al obtener asignaciones" },
      { status: 500 }
    );
  }
}

// PUT - Asignar proyectos e items a un usuario
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const currentUserId = (session.user as any)?.id as string;
    const currentUserRole = (session.user as any)?.role as string;

    if (!ROLES_CAN_ASSIGN.includes(currentUserRole as any)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const body = (await request.json()) as AssignmentPayload;
    const projectAssignments = body.projectAssignments || [];
    const itemAssignments = body.itemAssignments || [];

    const projectIdsFromProjectAssignments = projectAssignments.map((a) => a.projectId);
    const projectIdsFromItemAssignments = itemAssignments.map((a) => a.projectId);
    const allRequestedProjectIds = unique([
      ...projectIdsFromProjectAssignments,
      ...projectIdsFromItemAssignments,
    ]);

    let allowedProjectIds: string[] = [];

    if (currentUserRole === "DIRECTOR") {
      allowedProjectIds = await getDirectorProjectIds(currentUserId);

      const unauthorizedProject = allRequestedProjectIds.find(
        (projectId) => !allowedProjectIds.includes(projectId)
      );

      if (unauthorizedProject) {
        return NextResponse.json(
          { error: "No puedes asignar usuarios en proyectos fuera de tu direccion." },
          { status: 403 }
        );
      }
    }

    for (const assignment of itemAssignments) {
      const validBudgetItems = await prisma.budgetItem.findMany({
        where: {
          id: { in: assignment.budgetItemIds || [] },
          layer: { budget: { projectId: assignment.projectId } },
        },
        select: { id: true },
      });

      const validIds = new Set(validBudgetItems.map((item) => item.id));
      const invalid = assignment.budgetItemIds.find((id) => !validIds.has(id));

      if (invalid) {
        return NextResponse.json(
          { error: "Hay items que no pertenecen al proyecto seleccionado." },
          { status: 400 }
        );
      }
    }

    await prisma.$transaction(async (tx) => {
      if (projectAssignments.length > 0 || currentUserRole === "DIRECTOR") {
        const deleteProjectScope =
          currentUserRole === "DIRECTOR" ? allowedProjectIds : allRequestedProjectIds;

        if (deleteProjectScope.length > 0) {
          await tx.projectAssignment.deleteMany({
            where: {
              userId: params.id,
              projectId: { in: deleteProjectScope },
            },
          });
        }

        if (projectAssignments.length > 0) {
          await tx.projectAssignment.createMany({
            data: projectAssignments.map((assignment) => ({
              userId: params.userId,
              projectId: assignment.projectId,
              role: assignment.role as any,
            })),
            skipDuplicates: true,
          });
        }
      }

      if (itemAssignments.length > 0 || currentUserRole === "DIRECTOR") {
        const deleteItemScope =
          currentUserRole === "DIRECTOR" ? allowedProjectIds : allRequestedProjectIds;

        if (deleteItemScope.length > 0) {
          await tx.budgetItemAssignment.deleteMany({
            where: {
              userId: params.id,
              projectId: { in: deleteItemScope },
            },
          });
        }

        for (const assignment of itemAssignments) {
          if (!assignment.budgetItemIds || assignment.budgetItemIds.length === 0) continue;

          await tx.budgetItemAssignment.createMany({
            data: assignment.budgetItemIds.map((budgetItemId) => ({
              userId: params.userId,
              budgetItemId,
              projectId: assignment.projectId,
              assignedById: currentUserId,
            })),
            skipDuplicates: true,
          });
        }
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving assignments:", error);
    return NextResponse.json(
      { error: "Error al guardar asignaciones" },
      { status: 500 }
    );
  }
}
