import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { authOptions } from "@/app/api/auth/[...nextauth]/auth-options";

// GET - Obtener proveedor por ID
export async function GET(
  request: NextRequest,
  { params }: { params: { supplierId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const supplier = await prisma.supplier.findUnique({
      where: { id: params.supplierId },
      include: {
        documents: {
          orderBy: { uploadedAt: "desc" },
        },
      },
    });

    if (!supplier) {
      return NextResponse.json(
        { error: "Proveedor no encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json(supplier);
  } catch (error) {
    console.error("Error fetching supplier:", error);
    return NextResponse.json(
      { error: "Error al obtener proveedor" },
      { status: 500 }
    );
  }
}

// PUT - Actualizar proveedor
export async function PUT(
  request: NextRequest,
  { params }: { params: { supplierId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const normalizedPersonType = body.personType || "JURIDICA";

    const supplier = await prisma.supplier.update({
      where: { id: params.supplierId },
      data: {
        ...body,
        personType: normalizedPersonType,
        legalRepName: normalizedPersonType === "JURIDICA" ? body.legalRepName ?? null : null,
        legalRepCedula: normalizedPersonType === "JURIDICA" ? body.legalRepCedula ?? null : null,
        legalRepEmail: normalizedPersonType === "JURIDICA" ? body.legalRepEmail ?? null : null,
        legalRepPhone: normalizedPersonType === "JURIDICA" ? body.legalRepPhone ?? null : null,
        secondaryEmail: body.secondaryEmail ?? null,
        secondaryPhone: body.secondaryPhone ?? null,
        commercialType: body.commercialType ?? null,
        commercialSubcategory: body.commercialSubcategory ?? null,
      },
    });

    return NextResponse.json(supplier);
  } catch (error) {
    console.error("Error updating supplier:", error);
    return NextResponse.json(
      { error: "Error al actualizar proveedor" },
      { status: 500 }
    );
  }
}

// DELETE - Eliminar proveedor
export async function DELETE(
  request: NextRequest,
  { params }: { params: { supplierId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Verificar que el usuario sea admin
    const userRole = (session.user as any)?.role;
    if (!['ADMIN', 'GERENTE'].includes(userRole)) {
      return NextResponse.json(
        { error: "No tiene permisos para eliminar proveedores" },
        { status: 403 }
      );
    }

    await prisma.supplier.delete({
      where: { id: params.supplierId },
    });

    return NextResponse.json({ message: "Proveedor eliminado exitosamente" });
  } catch (error) {
    console.error("Error deleting supplier:", error);
    return NextResponse.json(
      { error: "Error al eliminar proveedor" },
      { status: 500 }
    );
  }
}
