import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/auth-options";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const contractors = await prisma.contractor.findMany({
      include: {
        documents: true,
        _count: {
          select: {
            workCuts: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(contractors);
  } catch (error) {
    console.error("Error obteniendo subcontratistas:", error);
    return NextResponse.json(
      { error: "Error al obtener subcontratistas" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Solo admin puede crear subcontratistas
    if ((session.user as any)?.role !== "ADMIN") {
      return NextResponse.json(
        { error: "No tienes permisos para realizar esta acción" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { 
      name, nit, contact, email, phone,
      // Campos extendidos
      address, city, department, postalCode, website,
      // Representante legal
      legalRepName, legalRepCedula, legalRepEmail, legalRepPhone,
      // Información financiera
      reportedIncome, incomeYear,
      // Referencias comerciales
      ref1Name, ref1Company, ref1Phone, ref1Email,
      ref2Name, ref2Company, ref2Phone, ref2Email,
      ref3Name, ref3Company, ref3Phone, ref3Email,
    } = body;

    if (!name || !nit || !contact || !email || !phone) {
      return NextResponse.json(
        { error: "Todos los campos obligatorios son requeridos" },
        { status: 400 }
      );
    }

    // Verificar si ya existe un subcontratista con ese NIT
    const existingContractor = await prisma.contractor.findUnique({
      where: { nit },
    });

    if (existingContractor) {
      return NextResponse.json(
        { error: "Ya existe un subcontratista con ese NIT" },
        { status: 400 }
      );
    }

    const contractor = await prisma.contractor.create({
      data: {
        name,
        nit,
        contact,
        email,
        phone,
        status: "INCOMPLETE",
        // Campos extendidos
        address: address || null,
        city: city || null,
        department: department || null,
        postalCode: postalCode || null,
        website: website || null,
        // Representante legal
        legalRepName: legalRepName || null,
        legalRepCedula: legalRepCedula || null,
        legalRepEmail: legalRepEmail || null,
        legalRepPhone: legalRepPhone || null,
        // Información financiera
        reportedIncome: reportedIncome || null,
        incomeYear: incomeYear || null,
        // Referencias comerciales
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

    return NextResponse.json(contractor, { status: 201 });
  } catch (error) {
    console.error("Error creando subcontratista:", error);
    return NextResponse.json(
      { error: "Error al crear subcontratista" },
      { status: 500 }
    );
  }
}
