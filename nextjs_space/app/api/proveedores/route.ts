import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { authOptions } from "@/app/api/auth/[...nextauth]/auth-options";

// GET - Listar proveedores
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const suppliers = await prisma.supplier.findMany({
      include: {
        documents: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(suppliers);
  } catch (error) {
    console.error("Error fetching suppliers:", error);
    return NextResponse.json(
      { error: "Error al obtener proveedores" },
      { status: 500 }
    );
  }
}

// POST - Crear proveedor
export async function POST(request: NextRequest) {
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
      category,
      address,
      city,
      department,
      postalCode,
      website,
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
      paymentTerms,
      deliveryTerms,
      minOrderValue,
    } = body;

    if (!name || !nit || !contact || !email || !phone) {
      return NextResponse.json(
        { error: "Todos los campos obligatorios son requeridos" },
        { status: 400 }
      );
    }

    // Verificar si el NIT ya existe
    const existingSupplier = await prisma.supplier.findUnique({
      where: { nit },
    });

    if (existingSupplier) {
      return NextResponse.json(
        { error: "Ya existe un proveedor con este NIT" },
        { status: 400 }
      );
    }

    const supplier = await prisma.supplier.create({
      data: {
        name,
        nit,
        contact,
        email,
        phone,
        category: category || "MATERIALES",
        address: address || null,
        city: city || null,
        department: department || null,
        postalCode: postalCode || null,
        website: website || null,
        legalRepName: legalRepName || null,
        legalRepCedula: legalRepCedula || null,
        legalRepEmail: legalRepEmail || null,
        legalRepPhone: legalRepPhone || null,
        reportedIncome: reportedIncome ? parseFloat(reportedIncome) : null,
        incomeYear: incomeYear ? parseInt(incomeYear) : null,
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
        paymentTerms: paymentTerms || null,
        deliveryTerms: deliveryTerms || null,
        minOrderValue: minOrderValue ? parseFloat(minOrderValue) : null,
      },
    });

    return NextResponse.json(supplier, { status: 201 });
  } catch (error) {
    console.error("Error creating supplier:", error);
    return NextResponse.json(
      { error: "Error al crear proveedor" },
      { status: 500 }
    );
  }
}
