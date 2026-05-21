import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/auth-options";
import { prisma } from "@/lib/db";
import { calculateBudgetTotals } from "@/lib/budget-calc";
import { calculateAiuBaseTotals } from "@/lib/budget-aiu";

// GET - Obtener presupuesto de un proyecto
export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { projectId } = params;

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        budget: {
          include: {
            versions: {
              orderBy: { createdAt: "desc" },
            },
            layers: {
              orderBy: { order: "asc" },
              include: {
                items: {
                  orderBy: { itemNumber: "asc" },
                },
              },
            },
          },
        },
        budgetFiles: {
          orderBy: { uploadedAt: "desc" },
        },
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Proyecto no encontrado" },
        { status: 404 }
      );
    }

    // Calcular estadísticas de items (verdes, amarillos, rojos)
    let greenCount = 0;
    let yellowCount = 0;
    let redCount = 0;
    let totalItems = 0;

    if (project.budget) {
      project.budget.layers.forEach((layer: any) => {
        layer.items.forEach((item: any) => {
          totalItems++;
          if (item.status === "GREEN") greenCount++;
          else if (item.status === "YELLOW") yellowCount++;
          else if (item.status === "RED") redCount++;
        });
      });
    }

    return NextResponse.json({
      project,
      itemStats: {
        total: totalItems,
        green: greenCount,
        yellow: yellowCount,
        red: redCount,
      },
    });
  } catch (error) {
    console.error("Error fetching budget:", error);
    return NextResponse.json(
      { error: "Error al obtener presupuesto" },
      { status: 500 }
    );
  }
}

// PUT - Actualizar presupuesto (AIU, índice PT, etc)
export async function PUT(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { projectId } = params;
    const body = await request.json();
    const { aiuPercentage, ptIndexPercentage, adminPercentage, imprevistoPercentage, utilidadPercentage, ivaUtilityPercentage } = body;

    const budget = await prisma.budget.findUnique({
      where: { projectId },
      include: {
        layers: {
          include: { items: true },
        },
      },
    });

    if (!budget) {
      return NextResponse.json(
        { error: "Presupuesto no encontrado" },
        { status: 404 }
      );
    }

    const newAdmin = adminPercentage ?? budget.adminPercentage;
    const newImprevisto = imprevistoPercentage ?? budget.imprevistoPercentage;
    const newUtilidad = utilidadPercentage ?? budget.utilidadPercentage;
    const newIva = ivaUtilityPercentage ?? budget.ivaUtilityPercentage;
    const newAiu = aiuPercentage ?? (newAdmin + newImprevisto + newUtilidad);
    const newPtIndex = ptIndexPercentage ?? budget.ptIndexPercentage;
    const ptFactor = newPtIndex / 100;

    // If ptIndexPercentage changed, recalculate all PT item/layer values
    if (ptIndexPercentage !== undefined && ptIndexPercentage !== budget.ptIndexPercentage) {
      // Update items sequentially (DB connection limit)
      for (const layer of budget.layers) {
        let layerTotalPT = 0;
        for (const item of layer.items) {
          const newUnitPricePT = item.unitPricePC * ptFactor;
          const newTotalPT = item.quantity * newUnitPricePT;
          layerTotalPT += newTotalPT;

          // Determine status based on PC vs PT
          let status: "GREEN" | "YELLOW" | "RED" = "GREEN";
          if (item.totalPC < newTotalPT) {
            const diff = ((newTotalPT - item.totalPC) / item.totalPC) * 100;
            status = diff >= 10 ? "RED" : "YELLOW";
          }

          await prisma.budgetItem.update({
            where: { id: item.id },
            data: {
              unitPricePT: newUnitPricePT,
              totalPT: newTotalPT,
              status,
            },
          });
        }

        // Update layer PT total
        await prisma.budgetLayer.update({
          where: { id: layer.id },
          data: { totalDirectCostPT: layerTotalPT },
        });
      }
    }

    // Recalculate budget-level totals with AIU breakdown
    const allItems = await prisma.budgetItem.findMany({
      where: { layer: { budgetId: budget.id } },
      select: {
        itemNumber: true,
        description: true,
        totalPC: true,
        totalPT: true,
      },
    });
    const totals = calculateAiuBaseTotals(allItems);

    const calcPC = calculateBudgetTotals({
      directCost: totals.aiuBasePC,
      adminPercentage: newAdmin,
      imprevistoPercentage: newImprevisto,
      utilidadPercentage: newUtilidad,
      ivaUtilityPercentage: newIva,
    });
    const calcPT = calculateBudgetTotals({
      directCost: totals.aiuBasePT,
      adminPercentage: newAdmin,
      imprevistoPercentage: newImprevisto,
      utilidadPercentage: newUtilidad,
      ivaUtilityPercentage: newIva,
    });

    const updatedBudget = await prisma.budget.update({
      where: { projectId },
      data: {
        aiuPercentage: newAiu,
        adminPercentage: newAdmin,
        imprevistoPercentage: newImprevisto,
        utilidadPercentage: newUtilidad,
        ivaUtilityPercentage: newIva,
        ptIndexPercentage: newPtIndex,
        totalDirectCostPC: totals.aiuBasePC,
        totalDirectCostPT: totals.aiuBasePT,
        totalAIU_PC: calcPC.totalAIU,
        totalAIU_PT: calcPT.totalAIU,
        totalIvaUtilidad_PC: calcPC.ivaUtilidad,
        totalIvaUtilidad_PT: calcPT.ivaUtilidad,
        totalPC: totals.aiuBasePC + calcPC.totalAIU + calcPC.ivaUtilidad + totals.tramitesPC,
        totalPT: totals.aiuBasePT + calcPT.totalAIU + calcPT.ivaUtilidad + totals.tramitesPT,
      },
      include: {
        versions: true,
        layers: {
          orderBy: { order: "asc" },
          include: {
            items: { orderBy: { itemNumber: "asc" } },
          },
        },
      },
    });

    // Sincronizar totalBudget del proyecto con el totalPC del presupuesto
    await prisma.project.update({
      where: { id: projectId },
      data: { totalBudget: totals.aiuBasePC + calcPC.totalAIU + calcPC.ivaUtilidad + totals.tramitesPC },
    });

    return NextResponse.json(updatedBudget);
  } catch (error) {
    console.error("Error updating budget:", error);
    return NextResponse.json(
      { error: "Error al actualizar presupuesto" },
      { status: 500 }
    );
  }
}
