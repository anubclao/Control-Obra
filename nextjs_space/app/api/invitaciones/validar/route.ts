import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// POST - Validar código de invitación
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code } = body;

    if (!code) {
      return NextResponse.json(
        { valid: false, error: "Código requerido" },
        { status: 400 }
      );
    }

    const invitation = await prisma.invitation.findUnique({
      where: { code: code.toUpperCase() },
      include: {
        project: { select: { id: true, name: true } },
      },
    });

    if (!invitation) {
      return NextResponse.json(
        { valid: false, error: "Código inválido" },
        { status: 404 }
      );
    }

    // Verificar si está activo
    if (!invitation.isActive) {
      return NextResponse.json(
        { valid: false, error: "Esta invitación ya no está activa" },
        { status: 400 }
      );
    }

    // Verificar si expiró
    if (new Date() > invitation.expiresAt) {
      return NextResponse.json(
        { valid: false, error: "Esta invitación ha expirado" },
        { status: 400 }
      );
    }

    // Verificar usos disponibles
    if (invitation.usedCount >= invitation.maxUses) {
      return NextResponse.json(
        { valid: false, error: "Esta invitación ya alcanzó el máximo de usos" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      valid: true,
      role: invitation.role,
      email: invitation.email,
      project: invitation.project,
    });
  } catch (error) {
    console.error("Error validating invitation:", error);
    return NextResponse.json(
      { valid: false, error: "Error al validar invitación" },
      { status: 500 }
    );
  }
}
