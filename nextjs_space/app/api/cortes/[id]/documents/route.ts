import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/auth-options";
import { prisma } from "@/lib/db";
import { uploadToSharePoint, generateSharePointPath } from "@/lib/sharepoint";
import { getFileUrl } from "@/lib/s3";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Solo admin puede subir documentos
    if ((session?.user as any)?.role !== "ADMIN") {
      return NextResponse.json(
        { error: "No tienes permisos para realizar esta acción" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { fileName, cloud_storage_path, isPublic, description } = body;

    if (!fileName || !cloud_storage_path) {
      return NextResponse.json(
        { error: "Campos requeridos faltantes" },
        { status: 400 }
      );
    }

    // Obtener el corte con información del proyecto y subcontratista
    const workCut = await prisma.workCut.findUnique({
      where: { id: params?.id },
      include: {
        project: true,
        contractor: true,
      },
    });

    if (!workCut) {
      return NextResponse.json(
        { error: "Corte no encontrado" },
        { status: 404 }
      );
    }

    // Crear el documento en la base de datos
    const document = await prisma.workCutDocument.create({
      data: {
        fileName,
        cloudStoragePath: cloud_storage_path,
        isPublic: isPublic ?? false,
        description: description ?? null,
        workCutId: params?.id,
      },
    });

    // Subir a SharePoint en background
    try {
      const fileUrl = await getFileUrl(cloud_storage_path, isPublic ?? false);
      const fileResponse = await fetch(fileUrl);
      const fileBuffer = Buffer.from(await fileResponse.arrayBuffer());

      const sharepointPath = generateSharePointPath(
        "workcut",
        workCut?.project?.name ?? "",
        workCut?.contractor?.name ?? "",
        `Corte_${workCut?.cutNumber ?? ""}`,
        fileName
      );

      const result = await uploadToSharePoint(sharepointPath, fileBuffer, fileName);

      if (result?.success) {
        // Actualizar con la ruta de SharePoint
        await prisma.workCutDocument.update({
          where: { id: document?.id },
          data: { sharepointPath: result?.url },
        });
      }
    } catch (spError) {
      console.error("Error subiendo a SharePoint:", spError);
      // Continuar aunque falle SharePoint
    }

    return NextResponse.json(document, { status: 201 });
  } catch (error) {
    console.error("Error subiendo documento:", error);
    return NextResponse.json(
      { error: "Error al subir documento" },
      { status: 500 }
    );
  }
}
