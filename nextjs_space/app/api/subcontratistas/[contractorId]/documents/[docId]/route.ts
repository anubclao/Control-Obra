import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/auth-options";
import { prisma } from "@/lib/db";
import { deleteFile } from "@/lib/s3";
import { syncContractorStatus } from "@/lib/contractor-status";

export const dynamic = "force-dynamic";

// DELETE - Eliminar un documento específico
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; docId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const allowedRoles = ["ADMIN", "GERENTE", "DIRECTOR"];
    if (!allowedRoles.includes((session.user as any)?.role)) {
      return NextResponse.json(
        { error: "No tienes permisos para realizar esta acción" },
        { status: 403 }
      );
    }

    // Verificar que el documento existe y pertenece al subcontratista
    const document = await prisma.document.findFirst({
      where: {
        id: params.docId,
        contractorId: params.id,
      },
    });

    if (!document) {
      return NextResponse.json(
        { error: "Documento no encontrado" },
        { status: 404 }
      );
    }

    // Eliminar archivo de S3
    try {
      await deleteFile(document.cloudStoragePath);
    } catch (s3Error) {
      console.error("Error eliminando archivo de S3:", s3Error);
    }

    // Eliminar de la base de datos
    await prisma.document.delete({
      where: { id: params.docId },
    });

    await syncContractorStatus(params.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error eliminando documento:", error);
    return NextResponse.json(
      { error: "Error al eliminar documento" },
      { status: 500 }
    );
  }
}
