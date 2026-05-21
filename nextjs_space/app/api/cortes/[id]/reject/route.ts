import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/auth-options";
import { prisma } from "@/lib/db";
import { invalidateFinancialReportCache } from '@/lib/financial-report';

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

    // Solo admin puede rechazar
    if ((session?.user as any)?.role !== "ADMIN") {
      return NextResponse.json(
        { error: "No tienes permisos para realizar esta acción" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { reason } = body;

    if (!reason) {
      return NextResponse.json(
        { error: "Debe proporcionar una razón para el rechazo" },
        { status: 400 }
      );
    }

    const workCut = await prisma.workCut.update({
      where: { id: params?.id },
      data: {
        status: "REJECTED",
        rejectionReason: reason,
      },
    });

    await invalidateFinancialReportCache();

    return NextResponse.json(workCut);
  } catch (error) {
    console.error("Error rechazando corte:", error);
    return NextResponse.json(
      { error: "Error al rechazar corte" },
      { status: 500 }
    );
  }
}
