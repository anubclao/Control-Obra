import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/auth-options";
import { prisma } from "@/lib/db";
import { uploadToSharePoint, generateSharePointPath } from "@/lib/sharepoint";
import { getFileUrl, readFile } from "@/lib/s3";
import { calculateBudgetTotals } from "@/lib/budget-calc";
import { calculateAiuBaseTotals } from "@/lib/budget-aiu";

interface ParsedItem {
  itemNumber: string;
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface ParsedChapter {
  code: string;
  name: string;
  items: ParsedItem[];
}

// POST - Importar presupuesto con detección automática de capítulos
export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Verificar rol
    const allowedRoles = ["ADMIN", "GERENTE", "DIRECTOR"];
    if (!allowedRoles.includes(session.user.role)) {
      return NextResponse.json({ error: "No tiene permisos para esta acción" }, { status: 403 });
    }

    const { projectId } = params;
    const body = await request.json();
    const { fileName, cloud_storage_path, isPublic, chapters, aiu } = body;

    // AIU breakdown from Excel (defaults match schema defaults)
    const adminPct = aiu?.admin ?? 8;
    const imprevistoPct = aiu?.imprevistos ?? 5;
    const utilidadPct = aiu?.utilidad ?? 5;
    const ivaPct = aiu?.ivaUtilidad ?? 19;
    const totalAiuPct = adminPct + imprevistoPct + utilidadPct;

    if (!chapters || !Array.isArray(chapters) || chapters.length === 0) {
      return NextResponse.json(
        { error: "No se encontraron capítulos válidos" },
        { status: 400 }
      );
    }

    // Obtener proyecto
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
          aiuPercentage: totalAiuPct,
          adminPercentage: adminPct,
          imprevistoPercentage: imprevistoPct,
          utilidadPercentage: utilidadPct,
          ivaUtilityPercentage: ivaPct,
          versions: {
            create: {
              name: "V1 Inicial",
              isActive: true,
            },
          },
        },
        include: { layers: true },
      });
    } else {
      // Sobreescribir: eliminar capas e ítems existentes
      // Primero eliminar ProgressEntries que referencian BudgetItems (sin cascade)
      const existingLayerIds = budget.layers.map((l: any) => l.id);
      if (existingLayerIds.length > 0) {
        const existingItemIds = await prisma.budgetItem.findMany({
          where: { layerId: { in: existingLayerIds } },
          select: { id: true },
        });
        const itemIds = existingItemIds.map((i) => i.id);
        if (itemIds.length > 0) {
          await prisma.progressEntry.deleteMany({
            where: { budgetItemId: { in: itemIds } },
          });
        }
        // Ahora eliminar capas (cascade elimina ítems)
        await prisma.budgetLayer.deleteMany({
          where: { budgetId: budget.id },
        });
      }

      // Actualizar AIU del presupuesto existente
      await prisma.budget.update({
        where: { id: budget.id },
        data: {
          aiuPercentage: totalAiuPct,
          adminPercentage: adminPct,
          imprevistoPercentage: imprevistoPct,
          utilidadPercentage: utilidadPct,
          ivaUtilityPercentage: ivaPct,
          totalDirectCostPC: 0,
          totalDirectCostPT: 0,
          totalAIU_PC: 0,
          totalAIU_PT: 0,
          totalIvaUtilidad_PC: 0,
          totalIvaUtilidad_PT: 0,
          totalPC: 0,
          totalPT: 0,
        },
      });
      budget.aiuPercentage = totalAiuPct;
      budget.layers = []; // Reset in-memory layers
    }

    let totalItemsCreated = 0;
    let totalChaptersCreated = 0;
    // Procesar cada capítulo
    for (const chapter of chapters as ParsedChapter[]) {
      // Buscar o crear la capa para este capítulo
      let layer = budget.layers.find(
        (l: any) => l.code.toUpperCase() === chapter.code.toUpperCase()
      );

      if (!layer) {
        layer = await prisma.budgetLayer.create({
          data: {
            budgetId: budget.id,
            code: chapter.code.toUpperCase(),
            name: chapter.name,
            order: budget.layers.length + totalChaptersCreated,
          },
        });
        totalChaptersCreated++;
      }

      // Crear los ítems del capítulo
      let layerTotalPC = 0;
      let layerTotalPT = 0;

      for (const item of chapter.items) {
        // Usar el mismo precio para PC y PT (o diferenciar si es necesario)
        const totalPC = item.totalPrice || (item.quantity * item.unitPrice);
        const totalPT = totalPC; // Mismo valor para PT
        const unitPricePC = item.unitPrice;
        const unitPricePT = item.unitPrice;

        // Determinar estado (siempre GREEN si PC = PT)
        const status = "GREEN";

        await prisma.budgetItem.create({
          data: {
            layerId: layer.id,
            itemNumber: item.itemNumber || String(totalItemsCreated + 1),
            description: item.description || "Sin descripción",
            unit: item.unit || "UN",
            quantity: item.quantity || 0,
            unitPricePC,
            unitPricePT,
            totalPC,
            totalPT,
            status,
          },
        });

        layerTotalPC += totalPC;
        layerTotalPT += totalPT;
        totalItemsCreated++;
      }

      // Actualizar totales de la capa
      await prisma.budgetLayer.update({
        where: { id: layer.id },
        data: {
          totalDirectCostPC: { increment: layerTotalPC },
          totalDirectCostPT: { increment: layerTotalPT },
        },
      });

    }

    // Recalcular totales del presupuesto con AIU discriminado
    const allBudgetItems = await prisma.budgetItem.findMany({
      where: { layer: { budgetId: budget.id } },
      select: {
        itemNumber: true,
        description: true,
        totalPC: true,
        totalPT: true,
      },
    });

    const totals = calculateAiuBaseTotals(allBudgetItems);

    const calcPC = calculateBudgetTotals({
      directCost: totals.aiuBasePC,
      adminPercentage: adminPct,
      imprevistoPercentage: imprevistoPct,
      utilidadPercentage: utilidadPct,
      ivaUtilityPercentage: ivaPct,
    });
    const calcPT = calculateBudgetTotals({
      directCost: totals.aiuBasePT,
      adminPercentage: adminPct,
      imprevistoPercentage: imprevistoPct,
      utilidadPercentage: utilidadPct,
      ivaUtilityPercentage: ivaPct,
    });

    await prisma.budget.update({
      where: { id: budget.id },
      data: {
        totalDirectCostPC: totals.aiuBasePC,
        totalDirectCostPT: totals.aiuBasePT,
        totalAIU_PC: calcPC.totalAIU,
        totalAIU_PT: calcPT.totalAIU,
        totalIvaUtilidad_PC: calcPC.ivaUtilidad,
        totalIvaUtilidad_PT: calcPT.ivaUtilidad,
        totalPC: totals.aiuBasePC + calcPC.totalAIU + calcPC.ivaUtilidad + totals.tramitesPC,
        totalPT: totals.aiuBasePT + calcPT.totalAIU + calcPT.ivaUtilidad + totals.tramitesPT,
      },
    });

    // Sincronizar totalBudget del proyecto con el totalPC del presupuesto
    await prisma.project.update({
      where: { id: projectId },
      data: { totalBudget: totals.aiuBasePC + calcPC.totalAIU + calcPC.ivaUtilidad + totals.tramitesPC },
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
          "Importación"
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
          layerCode: "MULTI", // Indica que afecta múltiples capas
          itemsImported: totalItemsCreated,
        },
      });
    }

    return NextResponse.json({
      success: true,
      itemsImported: totalItemsCreated,
      chaptersImported: totalChaptersCreated || (chapters as ParsedChapter[]).length,
      totalDirectCost: totals.aiuBasePC,
      totalExcluidoDeAiu: totals.excludedFromAiuPC,
      totalTramites: totals.tramitesPC,
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
