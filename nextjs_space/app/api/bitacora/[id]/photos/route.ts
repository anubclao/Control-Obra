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

    const body = await request.json();
    const { fileName, cloud_storage_path, isPublic, description } = body;

    if (!fileName || !cloud_storage_path) {
      return NextResponse.json(
        { error: "Campos requeridos faltantes" },
        { status: 400 }
      );
    }

    // Obtener el log con información del proyecto
    const workLog = await prisma.workLog.findUnique({
      where: { id: params?.id },
      include: {
        project: true,
      },
    });

    if (!workLog) {
      return NextResponse.json(
        { error: "Bitácora no encontrada" },
        { status: 404 }
      );
    }

    // Crear la foto en la base de datos
    const photo = await prisma.workLogPhoto.create({
      data: {
        fileName,
        cloudStoragePath: cloud_storage_path,
        isPublic: isPublic ?? false,
        description: description ?? null,
        workLogId: params?.id,
      },
    });

    // Subir a SharePoint en background
    try {
      const fileUrl = await getFileUrl(cloud_storage_path, isPublic ?? false);
      const fileResponse = await fetch(fileUrl);
      const fileBuffer = Buffer.from(await fileResponse.arrayBuffer());

      const dateStr = new Date(workLog?.date).toISOString().split("T")?.[0];
      const sharepointPath = generateSharePointPath(
        "worklog",
        workLog?.project?.name ?? "",
        dateStr ?? "",
        fileName
      );

      const result = await uploadToSharePoint(sharepointPath, fileBuffer, fileName);

      if (result?.success) {
        // Actualizar con la ruta de SharePoint
        await prisma.workLogPhoto.update({
          where: { id: photo?.id },
          data: { sharepointPath: result?.url },
        });
      }
    } catch (spError) {
      console.error("Error subiendo a SharePoint:", spError);
      // Continuar aunque falle SharePoint
    }

    return NextResponse.json(photo, { status: 201 });
  } catch (error) {
    console.error("Error subiendo foto:", error);
    return NextResponse.json(
      { error: "Error al subir foto" },
      { status: 500 }
    );
  }
}
