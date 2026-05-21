import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/auth-options";
import { prisma } from "@/lib/db";
import { uploadToSharePoint, generateSharePointPath } from "@/lib/sharepoint";
import { getFileUrl } from "@/lib/s3";
import { DOCUMENT_TYPE } from "@/lib/constants";
import { syncContractorStatus } from "@/lib/contractor-status";

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
    if ((session.user as any)?.role !== "ADMIN") {
      return NextResponse.json(
        { error: "No tienes permisos para realizar esta acción" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { type, fileName, cloud_storage_path, isPublic, expirationDate } = body;

    if (!type || !fileName || !cloud_storage_path) {
      return NextResponse.json(
        { error: "Campos requeridos faltantes" },
        { status: 400 }
      );
    }

    const VALID_DOC_TYPES = Object.keys(DOCUMENT_TYPE);
    if (!VALID_DOC_TYPES.includes(type)) {
      return NextResponse.json(
        { error: `Tipo de documento inválido. Valores permitidos: ${VALID_DOC_TYPES.join(", ")}` },
        { status: 400 }
      );
    }

    const ALLOWED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png", ".doc", ".docx"];
    const ext = fileName.toLowerCase().slice(fileName.lastIndexOf("."));
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { error: "Extensión de archivo no permitida. Solo se aceptan PDF, JPG, PNG, DOC o DOCX." },
        { status: 400 }
      );
    }

    if (expirationDate && isNaN(Date.parse(expirationDate))) {
      return NextResponse.json(
        { error: "Fecha de vencimiento inválida" },
        { status: 400 }
      );
    }

    // Obtener el subcontratista
    const contractor = await prisma.contractor.findUnique({
      where: { id: params.contractorId },
    });

    if (!contractor) {
      return NextResponse.json(
        { error: "Subcontratista no encontrado" },
        { status: 404 }
      );
    }

    // Eliminar documento existente del mismo tipo si existe
    await prisma.document.deleteMany({
      where: {
        contractorId: params.contractorId,
        type,
      },
    });

    // Crear el documento en la base de datos
    const document = await prisma.document.create({
      data: {
        type,
        fileName,
        cloudStoragePath: cloud_storage_path,
        isPublic: isPublic ?? false,
        expirationDate: expirationDate ? new Date(expirationDate) : null,
        contractorId: params.id,
      },
    });

    // Subir a SharePoint en background
    try {
      const fileUrl = await getFileUrl(cloud_storage_path, isPublic ?? false);
      const absoluteFileUrl = fileUrl.startsWith("http")
        ? fileUrl
        : new URL(fileUrl, request.url).toString();
      const fileResponse = await fetch(absoluteFileUrl);
      const fileBuffer = Buffer.from(await fileResponse.arrayBuffer());

      const docTypeName = DOCUMENT_TYPE[type as keyof typeof DOCUMENT_TYPE];
      const sharepointPath = generateSharePointPath(
        "contractor",
        contractor.name,
        docTypeName,
        fileName
      );

      const result = await uploadToSharePoint(sharepointPath, fileBuffer, fileName);

      if (result?.success) {
        // Actualizar con la ruta de SharePoint
        await prisma.document.update({
          where: { id: document.id },
          data: { sharepointPath: result?.url },
        });
      }
    } catch (spError) {
      console.error("Error subiendo a SharePoint:", spError);
      // Continuar aunque falle SharePoint
    }

    await syncContractorStatus(params.id);

    return NextResponse.json(document, { status: 201 });
  } catch (error) {
    console.error("Error subiendo documento:", error);
    return NextResponse.json(
      { error: "Error al subir documento" },
      { status: 500 }
    );
  }
}
