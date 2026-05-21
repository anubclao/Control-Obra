import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, password, phone, code } = body;

    // Validaciones básicas
    if (!name || !email || !password || !code) {
      return NextResponse.json(
        { error: "Todos los campos son requeridos" },
        { status: 400 }
      );
    }

    // Validar código de invitación
    const invitation = await prisma.invitation.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (!invitation) {
      return NextResponse.json(
        { error: "Código de invitación inválido" },
        { status: 400 }
      );
    }

    if (!invitation.isActive) {
      return NextResponse.json(
        { error: "Esta invitación ya no está activa" },
        { status: 400 }
      );
    }

    if (new Date() > invitation.expiresAt) {
      return NextResponse.json(
        { error: "Esta invitación ha expirado" },
        { status: 400 }
      );
    }

    if (invitation.usedCount >= invitation.maxUses) {
      return NextResponse.json(
        { error: "Esta invitación ya alcanzó el máximo de usos" },
        { status: 400 }
      );
    }

    // Verificar email específico si está definido
    if (invitation.email && invitation.email.toLowerCase() !== email.toLowerCase()) {
      return NextResponse.json(
        { error: "Este código está reservado para otro email" },
        { status: 400 }
      );
    }

    // Verificar si el email ya existe
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Ya existe un usuario con este email" },
        { status: 400 }
      );
    }

    // Hash de la contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // Crear usuario en transacción
    const user = await prisma.$transaction(async (tx) => {
      // Crear usuario
      const newUser = await tx.user.create({
        data: {
          name,
          email: email.toLowerCase(),
          password: hashedPassword,
          phone: phone || null,
          role: invitation.role,
        },
      });

      // Actualizar invitación
      await tx.invitation.update({
        where: { id: invitation.id },
        data: {
          usedCount: { increment: 1 },
          usedById: invitation.maxUses === 1 ? newUser.id : null,
        },
      });

      // Si hay proyecto asignado, crear asignación
      if (invitation.projectId) {
        await tx.projectAssignment.create({
          data: {
            userId: newUser.id,
            projectId: invitation.projectId,
            role: invitation.role,
          },
        });
      }

      return newUser;
    });

    return NextResponse.json(
      {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error registering user:", error);
    return NextResponse.json(
      { error: "Error al registrar usuario" },
      { status: 500 }
    );
  }
}
