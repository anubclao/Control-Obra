import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/auth-options";
import { prisma } from "@/lib/db";
import { uploadToSharePoint, generateSharePointPath } from "@/lib/sharepoint";
import { getFileUrl, readFile } from "@/lib/s3";
import { calculateBudgetTotals } from "@/lib/budget-calc";

interface ImportedItem {
  itemNumber: string;
  description: string;
  unit: string;
  quantity: number;
  unitPricePC: number;
  unitPricePT: number;
}

function calculateItemStatus(totalPC: number, totalPT: number): "GREEN" | "YELLOW" | "RED" {
  if (totalPC >= totalPT) return "GREEN";
  const diff = ((totalPT - totalPC) / totalPT) * 100;
  return diff < 10 ? "YELLOW" : "RED";
}

// POST - Importar presupuesto desde Excel
export async function POST(
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
    const { layerCode, fileName, cloud_storage_path, isPublic, items } = body;

    if (!layerCode || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Capa e ítems son requeridos" },
        { status: 400 }
      );
    }

    // Obtener proyecto y presupuesto
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        budget: {
          include: { layers: true },
        },
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Proyecto no encontrado" },
        { status: 404 }
      );
    }

    // Crear presupuesto si no existe
    let budget = project.budget;
    if (!budget) {
      budget = await prisma.budget.create({
        data: {
          projectId,
          aiuPercentage: 30,
          versions: {
            create: {
              name: "V1 Inicial",
              isActive: true,
            },
          },
        },
        include: { layers: true },
      });
    }

    // Buscar o crear la capa
    let layer = budget.layers.find(
      (l: any) => l.code.toUpperCase() === layerCode.toUpperCase()
    );

    if (!layer) {
      layer = await prisma.budgetLayer.create({
        data: {
          budgetId: budget.id,
          code: layerCode.toUpperCase(),
          name: layerCode,
          order: budget.layers.length,
        },
      });
    } else {
      // Sobreescribir: eliminar ítems existentes de esta capa
      const existingItems = await prisma.budgetItem.findMany({
        where: { layerId: layer.id },
        select: { id: true },
      });
      const itemIds = existingItems.map((i) => i.id);
      if (itemIds.length > 0) {
        await prisma.progressEntry.deleteMany({
          where: { budgetItemId: { in: itemIds } },
        });
        await prisma.budgetItem.deleteMany({
          where: { layerId: layer.id },
        });
      }
      // Reset layer totals
      await prisma.budgetLayer.update({
        where: { id: layer.id },
        data: { totalDirectCostPC: 0, totalDirectCostPT: 0 },
      });
    }

    // Crear los ítems
    let totalDirectCostPC = 0;
    let totalDirectCostPT = 0;

    const createdItems = await Promise.all(
      (items as ImportedItem[]).map(async (item) => {
        const totalPC = item.quantity * item.unitPricePC;
        const totalPT = item.quantity * item.unitPricePT;
        const status = calculateItemStatus(totalPC, totalPT);

        totalDirectCostPC += totalPC;
        totalDirectCostPT += totalPT;

        return prisma.budgetItem.create({
          data: {
            layerId: layer!.id,
            itemNumber: item.itemNumber || "0",
            description: item.description || "Sin descripción",
            unit: item.unit || "UN",
            quantity: item.quantity || 0,
            unitPricePC: item.unitPricePC || 0,
            unitPricePT: item.unitPricePT || 0,
            totalPC,
            totalPT,
            status,
          },
        });
      })
    );

    // Actualizar totales de la capa
    await prisma.budgetLayer.update({
      where: { id: layer.id },
      data: {
        totalDirectCostPC: { increment: totalDirectCostPC },
        totalDirectCostPT: { increment: totalDirectCostPT },
      },
    });

    // Recalcular totales del presupuesto
    const allLayers = await prisma.budgetLayer.findMany({
      where: { budgetId: budget.id },
    });

    const totalBudgetDirectPC = allLayers.reduce(
      (sum: number, l: any) => sum + l.totalDirectCostPC,
      0
    );
    const totalBudgetDirectPT = allLayers.reduce(
      (sum: number, l: any) => sum + l.totalDirectCostPT,
      0
    );

    const calcPC = calculateBudgetTotals({
      directCost: totalBudgetDirectPC,
      adminPercentage: budget.adminPercentage,
      imprevistoPercentage: budget.imprevistoPercentage,
      utilidadPercentage: budget.utilidadPercentage,
      ivaUtilityPercentage: budget.ivaUtilityPercentage,
    });
    const calcPT = calculateBudgetTotals({
      directCost: totalBudgetDirectPT,
      adminPercentage: budget.adminPercentage,
      imprevistoPercentage: budget.imprevistoPercentage,
      utilidadPercentage: budget.utilidadPercentage,
      ivaUtilityPercentage: budget.ivaUtilityPercentage,
    });

    await prisma.budget.update({
      where: { id: budget.id },
      data: {
        totalDirectCostPC: totalBudgetDirectPC,
        totalDirectCostPT: totalBudgetDirectPT,
        totalAIU_PC: calcPC.totalAIU,
        totalAIU_PT: calcPT.totalAIU,
        totalIvaUtilidad_PC: calcPC.ivaUtilidad,
        totalIvaUtilidad_PT: calcPT.ivaUtilidad,
        totalPC: calcPC.total,
        totalPT: calcPT.total,
      },
    });

    // Sincronizar totalBudget del proyecto con el totalPC del presupuesto
    await prisma.project.update({
      where: { id: projectId },
      data: { totalBudget: calcPC.total },
    });

    // Guardar archivo si se proporcionó
    let sharepointPath = null;
    if (cloud_storage_path && fileName) {
      // Subir a SharePoint
      try {
        let fileBuffer = await readFile(cloud_storage_path);

        // Fallback para compatibilidad: si no se encuentra en disco local,
        // intentar por URL absoluta.
        if (!fileBuffer) {
          const fileUrl = await getFileUrl(cloud_storage_path, isPublic || false);
          const absoluteFileUrl = fileUrl.startsWith("http")
            ? fileUrl
            : new URL(fileUrl, request.nextUrl.origin).toString();
          const response = await fetch(absoluteFileUrl);
          fileBuffer = Buffer.from(await response.arrayBuffer());
        }
        
        const spPath = generateSharePointPath(
          "budget",
          project.name,
          layerCode.toUpperCase()
        );
        const spResult = await uploadToSharePoint(spPath, fileBuffer, fileName);
        if (spResult.success) {
          sharepointPath = spResult.url || null;
        }
      } catch (spError) {
        console.error("Error uploading to SharePoint:", spError);
      }

      // Registrar archivo en la BD
      await prisma.budgetFile.create({
        data: {
          projectId,
          fileName,
          cloudStoragePath: cloud_storage_path,
          isPublic: isPublic || false,
          sharepointPath,
          layerCode: layerCode.toUpperCase(),
          itemsImported: createdItems.length,
        },
      });
    }

    return NextResponse.json({
      success: true,
      itemsImported: createdItems.length,
      layerCode: layerCode.toUpperCase(),
      sharepointPath,
    });
  } catch (error) {
    console.error("Error importing budget:", error);
    return NextResponse.json(
      { error: "Error al importar presupuesto" },
      { status: 500 }
    );
  }
}
