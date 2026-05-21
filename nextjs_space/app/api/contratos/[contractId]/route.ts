import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/auth-options";
import { prisma } from "@/lib/db";
import { REQUIRED_CONTRACT_DOCUMENTS } from "@/lib/constants";

function normalizeDocumentType(value?: string | null): string {
  if (!value) return "";
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

// GET - Obtener contrato por ID
export async function GET(
  request: NextRequest,
  { params }: { params: { contractId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const contract = await prisma.contract.findUnique({
      where: { id: params.contractId },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            code: true,
            client: true,
          },
        },
        contractor: {
          select: {
            id: true,
            name: true,
            nit: true,
            email: true,
            phone: true,
            status: true,
          },
        },
        documents: {
          orderBy: { uploadedAt: "desc" },
        },
      },
    });

    if (!contract) {
      return NextResponse.json(
        { error: "Contrato no encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json(contract);
  } catch (error) {
    console.error("Error fetching contract:", error);
    return NextResponse.json(
      { error: "Error al obtener contrato" },
      { status: 500 }
    );
  }
}

// PUT - Actualizar contrato
export async function PUT(
  request: NextRequest,
  { params }: { params: { contractId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const {
      contractType,
      paymentMethod,
      startDate,
      endDate,
      contractObject,
      contractValue,
      status,
      observations,
    } = body;

    if (status === "ENABLED") {
      const existingDocs = await prisma.contractDocument.findMany({
        where: { contractId: params.contractId },
        select: { documentType: true },
      });

      const existingTypes = new Set(
        existingDocs.map((doc) => normalizeDocumentType(doc.documentType))
      );

      const missingRequiredDocs = REQUIRED_CONTRACT_DOCUMENTS.filter(
        (docType) => !existingTypes.has(docType)
      );

      if (missingRequiredDocs.length > 0) {
        return NextResponse.json(
          {
            error:
              "No se puede habilitar el contrato. Debes cargar los documentos obligatorios: Contrato y Póliza.",
          },
          { status: 400 }
        );
      }
    }

    const contract = await prisma.contract.update({
      where: { id: params.contractId },
      data: {
        ...(contractType && { contractType }),
        ...(paymentMethod && { paymentMethod }),
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
        ...(contractObject && { contractObject }),
        ...(contractValue !== undefined && { contractValue }),
        ...(status && { status }),
        ...(observations !== undefined && { observations }),
      },
      include: {
        project: { select: { name: true } },
        contractor: { select: { name: true } },
      },
    });

    return NextResponse.json(contract);
  } catch (error) {
    console.error("Error updating contract:", error);
    return NextResponse.json(
      { error: "Error al actualizar contrato" },
      { status: 500 }
    );
  }
}

// DELETE - Eliminar contrato
export async function DELETE(
  request: NextRequest,
  { params }: { params: { contractId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    await prisma.contract.delete({
      where: { id: params.contractId },
    });

    return NextResponse.json({ message: "Contrato eliminado" });
  } catch (error) {
    console.error("Error deleting contract:", error);
    return NextResponse.json(
      { error: "Error al eliminar contrato" },
      { status: 500 }
    );
  }
}
