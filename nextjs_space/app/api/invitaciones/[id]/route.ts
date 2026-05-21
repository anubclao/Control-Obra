import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/auth-options";
import { prisma } from "@/lib/db";
import { ROLES_CAN_INVITE } from "@/lib/constants";

// DELETE - Desactivar invitación
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    if (!ROLES_CAN_INVITE.includes(session.user.role as any)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    await prisma.invitation.update({
      where: { id: params.id },
      data: { isActive: false },
    });

    return NextResponse.json({ message: "Invitación desactivada" });
  } catch (error) {
    console.error("Error deactivating invitation:", error);
    return NextResponse.json(
      { error: "Error al desactivar invitación" },
      { status: 500 }
    );
  }
}
