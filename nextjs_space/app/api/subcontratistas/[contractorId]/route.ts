import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/auth-options";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { contractorId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const contractor = await prisma.contractor.findUnique({
      where: { id: params.contractorId },
      include: {
        documents: {
          orderBy: { uploadedAt: "desc" },
        },
        workCuts: {
          include: {
            project: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!contractor) {
      return NextResponse.json(
        { error: "Subcontratista no encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json(contractor);
  } catch (error) {
    console.error("Error obteniendo subcontratista:", error);
    return NextResponse.json(
      { error: "Error al obtener subcontratista" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { contractorId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      nit,
      contact,
      email,
      phone,
      website,
      address,
      city,
      department,
      postalCode,
      legalRepName,
      legalRepCedula,
      legalRepEmail,
      legalRepPhone,
      reportedIncome,
      incomeYear,
      ref1Name,
      ref1Company,
      ref1Phone,
      ref1Email,
      ref2Name,
      ref2Company,
      ref2Phone,
      ref2Email,
      ref3Name,
      ref3Company,
      ref3Phone,
      ref3Email,
    } = body;

    const contractor = await prisma.contractor.update({
      where: { id: params.contractorId },
      data: {
        name,
        nit,
        contact,
        email,
        phone,
        website: website || null,
        address: address || null,
        city: city || null,
        department: department || null,
        postalCode: postalCode || null,
        legalRepName: legalRepName || null,
        legalRepCedula: legalRepCedula || null,
        legalRepEmail: legalRepEmail || null,
        legalRepPhone: legalRepPhone || null,
        reportedIncome: reportedIncome || null,
        incomeYear: incomeYear || null,
        ref1Name: ref1Name || null,
        ref1Company: ref1Company || null,
        ref1Phone: ref1Phone || null,
        ref1Email: ref1Email || null,
        ref2Name: ref2Name || null,
        ref2Company: ref2Company || null,
        ref2Phone: ref2Phone || null,
        ref2Email: ref2Email || null,
        ref3Name: ref3Name || null,
        ref3Company: ref3Company || null,
        ref3Phone: ref3Phone || null,
        ref3Email: ref3Email || null,
      },
    });

    return NextResponse.json(contractor);
  } catch (error) {
    console.error("Error actualizando subcontratista:", error);
    return NextResponse.json(
      { error: "Error al actualizar subcontratista" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { contractorId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Solo admin puede eliminar
    if ((session.user as any)?.role !== "ADMIN") {
      return NextResponse.json(
        { error: "No tienes permisos para realizar esta acción" },
        { status: 403 }
      );
    }

    await prisma.contractor.delete({
      where: { id: params.contractorId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error eliminando subcontratista:", error);
    return NextResponse.json(
      { error: "Error al eliminar subcontratista" },
      { status: 500 }
    );
  }
}
