import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/auth-options";
import { generatePresignedUploadUrl } from "@/lib/s3";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { fileName, contentType, isPublic } = body;

    if (!fileName || !contentType) {
      return NextResponse.json(
        { error: "fileName y contentType son requeridos" },
        { status: 400 }
      );
    }

    const ALLOWED_CONTENT_TYPES = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

    if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
      return NextResponse.json(
        { error: "Tipo de archivo no permitido. Solo se aceptan PDF, JPG, PNG, DOC o DOCX." },
        { status: 400 }
      );
    }

    // Sanitize filename: remove path traversal, keep only safe characters
    const sanitizedFileName = (fileName as string)
      .replace(/[^a-zA-Z0-9._\-\s]/g, "_")
      .replace(/\.{2,}/g, "_")
      .trim()
      .slice(0, 255);

    if (!sanitizedFileName) {
      return NextResponse.json(
        { error: "Nombre de archivo inválido" },
        { status: 400 }
      );
    }

    const { uploadUrl, cloud_storage_path } = await generatePresignedUploadUrl(
      sanitizedFileName,
      contentType,
      isPublic ?? false
    );

    return NextResponse.json({ uploadUrl, cloud_storage_path });
  } catch (error) {
    console.error("Error generando URL presignada:", error);
    return NextResponse.json(
      { error: "Error al generar URL de carga" },
      { status: 500 }
    );
  }
}
