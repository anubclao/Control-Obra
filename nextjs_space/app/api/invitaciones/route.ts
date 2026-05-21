import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/auth-options";
import { prisma } from "@/lib/db";
import { ROLES_CAN_INVITE } from "@/lib/constants";

// Generar código único de 8 caracteres
function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Sin O, 0, I, 1 para evitar confusión
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// GET - Listar invitaciones
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Solo ADMIN y GERENTE pueden ver invitaciones
    if (!ROLES_CAN_INVITE.includes(session.user.role as any)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const invitations = await prisma.invitation.findMany({
      include: {
        createdBy: {
          select: { name: true, email: true },
        },
        usedBy: {
          select: { name: true, email: true },
        },
        project: {
          select: { name: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(invitations);
  } catch (error) {
    console.error("Error fetching invitations:", error);
    return NextResponse.json(
      { error: "Error al obtener invitaciones" },
      { status: 500 }
    );
  }
}

// POST - Crear nueva invitación
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Solo ADMIN y GERENTE pueden crear invitaciones
    if (!ROLES_CAN_INVITE.includes(session.user.role as any)) {
      return NextResponse.json({ error: "Sin permisos para invitar" }, { status: 403 });
    }

    const body = await request.json();
    const { email, role, projectId, expiresInDays = 7, maxUses = 1 } = body;

    if (!role) {
      return NextResponse.json(
        { error: "El rol es requerido" },
        { status: 400 }
      );
    }

    // Generar código único
    let code = generateCode();
    let exists = await prisma.invitation.findUnique({ where: { code } });
    while (exists) {
      code = generateCode();
      exists = await prisma.invitation.findUnique({ where: { code } });
    }

    // Calcular fecha de expiración
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    const invitation = await prisma.invitation.create({
      data: {
        code,
        email: email || null,
        role,
        projectId: projectId || null,
        expiresAt,
        maxUses,
        createdById: session.user.id,
      },
      include: {
        project: { select: { name: true } },
      },
    });

    return NextResponse.json(invitation, { status: 201 });
  } catch (error) {
    console.error("Error creating invitation:", error);
    return NextResponse.json(
      { error: "Error al crear invitación" },
      { status: 500 }
    );
  }
}
