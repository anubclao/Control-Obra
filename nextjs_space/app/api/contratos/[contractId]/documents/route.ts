import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/auth-options";
import { prisma } from "@/lib/db";
import { CONTRACT_DOCUMENT_TYPE } from "@/lib/constants";

export const dynamic = "force-dynamic";

const ALLOWED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png", ".doc", ".docx"];
const REPLACEABLE_TYPES = new Set(["CONTRATO", "POLIZA"]);

function normalizeDocumentType(value?: string | null): string {
  if (!value) return "";
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

// POST - Subir documento de contrato
export async function POST(
  request: NextRequest,
  { params }: { params: { contractId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    if ((session.user as any)?.role !== "ADMIN") {
      return NextResponse.json(
        { error: "No tienes permisos para realizar esta acción" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { documentType, fileName, cloud_storage_path, isPublic, description } = body;

    if (!documentType || !fileName || !cloud_storage_path) {
      return NextResponse.json(
        { error: "Campos requeridos faltantes" },
        { status: 400 }
      );
    }

    const normalizedType = normalizeDocumentType(documentType);
    const validTypes = Object.keys(CONTRACT_DOCUMENT_TYPE);

    if (!validTypes.includes(normalizedType)) {
      return NextResponse.json(
        { error: `Tipo de documento inválido. Valores permitidos: ${validTypes.join(", ")}` },
        { status: 400 }
      );
    }

    const ext = fileName.toLowerCase().slice(fileName.lastIndexOf("."));
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { error: "Extensión de archivo no permitida. Solo se aceptan PDF, JPG, PNG, DOC o DOCX." },
        { status: 400 }
      );
    }

    const contract = await prisma.contract.findUnique({
      where: { id: params.contractId },
      select: { id: true },
    });

    if (!contract) {
      return NextResponse.json(
        { error: "Contrato no encontrado" },
        { status: 404 }
      );
    }

    if (REPLACEABLE_TYPES.has(normalizedType)) {
      await prisma.contractDocument.deleteMany({
        where: {
          contractId: params.contractId,
          documentType: normalizedType,
        },
      });
    }

    const document = await prisma.contractDocument.create({
      data: {
        contractId: params.contractId,
        documentType: normalizedType,
        fileName,
        cloudStoragePath: cloud_storage_path,
        isPublic: isPublic ?? false,
        description: description || null,
      },
    });

    return NextResponse.json(document, { status: 201 });
  } catch (error) {
    console.error("Error subiendo documento de contrato:", error);
    return NextResponse.json(
      { error: "Error al subir documento de contrato" },
      { status: 500 }
    );
  }
}
