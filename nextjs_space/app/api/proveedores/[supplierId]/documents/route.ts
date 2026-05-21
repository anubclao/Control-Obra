import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { authOptions } from "@/app/api/auth/[...nextauth]/auth-options";
import { SupplierDocument } from "@prisma/client";

// POST - Agregar documento a proveedor
export async function POST(
  request: NextRequest,
  { params }: { params: { supplierId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { type, fileName, cloud_storage_path, isPublic, expirationDate } = body;

    if (!type || !fileName || !cloud_storage_path) {
      return NextResponse.json(
        { error: "Tipo, nombre de archivo y ruta son requeridos" },
        { status: 400 }
      );
    }

    // Verificar que el proveedor existe
    const supplier = await prisma.supplier.findUnique({
      where: { id: params.supplierId },
    });

    if (!supplier) {
      return NextResponse.json(
        { error: "Proveedor no encontrado" },
        { status: 404 }
      );
    }

    // Eliminar documento existente del mismo tipo
    await prisma.supplierDocument.deleteMany({
      where: {
        supplierId: params.supplierId,
        type: type,
      },
    });

    // Crear nuevo documento
    const document = await prisma.supplierDocument.create({
      data: {
        type,
        fileName,
        cloudStoragePath: cloud_storage_path,
        isPublic: isPublic || false,
        expirationDate: expirationDate ? new Date(expirationDate) : null,
        supplierId: params.supplierId,
      },
    });

    // Actualizar estado del proveedor
    await updateSupplierStatus(params.supplierId);

    return NextResponse.json(document, { status: 201 });
  } catch (error) {
    console.error("Error uploading document:", error);
    return NextResponse.json(
      { error: "Error al subir documento" },
      { status: 500 }
    );
  }
}

async function updateSupplierStatus(supplierId: string) {
  const requiredDocs = ["CEDULA", "RUT", "CAMARA_COMERCIO", "CERTIFICADO_BANCARIO"];

  const documents: SupplierDocument[] = await prisma.supplierDocument.findMany({
    where: { supplierId },
  });

  const uploadedTypes = documents.map((d: SupplierDocument) => d.type);
  const hasAllRequired = requiredDocs.every((type) =>
    uploadedTypes.includes(type as SupplierDocument["type"])
  );

  // Verificar documentos vencidos
  const now = new Date();
  const hasExpired = documents.some(
    (d: SupplierDocument) => d.expirationDate && d.expirationDate < now
  );

  let status: "COMPLETE" | "INCOMPLETE" | "EXPIRED" = "INCOMPLETE";
  if (hasExpired) {
    status = "EXPIRED";
  } else if (hasAllRequired) {
    status = "COMPLETE";
  }

  await prisma.supplier.update({
    where: { id: supplierId },
    data: { status },
  });
}
