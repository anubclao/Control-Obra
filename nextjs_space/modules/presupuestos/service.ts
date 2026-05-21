import { prisma } from "@/lib/db";
import { UpdateBudgetAIUInput, CreateBudgetLayerInput, CreateBudgetItemInput } from "./validations";
import { calculateAiuBaseTotals } from "@/lib/budget-aiu";

function calcItemStatus(pc: number, pt: number): "GREEN" | "YELLOW" | "RED" {
  if (pt === 0 || pc >= pt) return "GREEN";
  const diffPct = ((pt - pc) / pt) * 100;
  return diffPct < 10 ? "YELLOW" : "RED";
}

export async function getBudgetByProject(projectId: string) {
  return prisma.budget.findUnique({
    where: { projectId },
    include: {
      layers: {
        include: { items: { orderBy: { itemNumber: "asc" } } },
        orderBy: { order: "asc" },
      },
      versions: { orderBy: { createdAt: "desc" } },
    },
  });
}

export async function ensureBudgetExists(projectId: string) {
  const existing = await prisma.budget.findUnique({ where: { projectId } });
  if (existing) return existing;
  return prisma.budget.create({ data: { projectId } });
}

export async function updateBudgetAIU(projectId: string, input: UpdateBudgetAIUInput) {
  const budget = await ensureBudgetExists(projectId);
  const aiuPct = input.adminPercentage + input.imprevistoPercentage + input.utilidadPercentage;

  const items = await prisma.budgetItem.findMany({
    where: { layer: { budgetId: budget.id } },
    select: {
      itemNumber: true,
      description: true,
      totalPC: true,
      totalPT: true,
    },
  });

  const totals = calculateAiuBaseTotals(items);

  const aiuPC = totals.aiuBasePC * (aiuPct / 100);
  const aiuPT = totals.aiuBasePT * (aiuPct / 100);
  const ivaPC = totals.aiuBasePC * (input.utilidadPercentage / 100) * (input.ivaUtilityPercentage / 100);
  const ivaPT = totals.aiuBasePT * (input.utilidadPercentage / 100) * (input.ivaUtilityPercentage / 100);

  return prisma.budget.update({
    where: { id: budget.id },
    data: {
      ...input,
      aiuPercentage: aiuPct,
      totalDirectCostPC: totals.aiuBasePC,
      totalDirectCostPT: totals.aiuBasePT,
      totalAIU_PC: aiuPC,
      totalAIU_PT: aiuPT,
      totalIvaUtilidad_PC: ivaPC,
      totalIvaUtilidad_PT: ivaPT,
      totalPC: totals.aiuBasePC + aiuPC + ivaPC + totals.tramitesPC,
      totalPT: totals.aiuBasePT + aiuPT + ivaPT + totals.tramitesPT,
    },
  });
}

export async function createBudgetLayer(projectId: string, input: CreateBudgetLayerInput) {
  const budget = await ensureBudgetExists(projectId);
  return prisma.budgetLayer.create({
    data: { ...input, budgetId: budget.id },
    include: { items: true },
  });
}

export async function createBudgetItem(input: CreateBudgetItemInput) {
  const totalPC = input.quantity * input.unitPricePC;
  const totalPT = input.quantity * input.unitPricePT;
  const status = calcItemStatus(totalPC, totalPT);

  const item = await prisma.budgetItem.create({
    data: { ...input, totalPC, totalPT, status },
  });

  // Actualizar totales de la capa
  await recalcLayerTotals(input.layerId);

  return item;
}

export async function recalcLayerTotals(layerId: string) {
  const items = await prisma.budgetItem.findMany({ where: { layerId } });
  const totalPC = items.reduce((s, i) => s + i.totalPC, 0);
  const totalPT = items.reduce((s, i) => s + i.totalPT, 0);

  const layer = await prisma.budgetLayer.update({
    where: { id: layerId },
    data: { totalDirectCostPC: totalPC, totalDirectCostPT: totalPT },
  });

  // Recalcular el presupuesto completo
  await recalcBudgetTotals(layer.budgetId);

  return layer;
}

export async function recalcBudgetTotals(budgetId: string) {
  const budget = await prisma.budget.findUnique({
    where: { id: budgetId },
    select: {
      aiuPercentage: true,
      utilidadPercentage: true,
      ivaUtilityPercentage: true,
    },
  });
  if (!budget) return;

  const items = await prisma.budgetItem.findMany({
    where: { layer: { budgetId } },
    select: {
      itemNumber: true,
      description: true,
      totalPC: true,
      totalPT: true,
    },
  });

  const totals = calculateAiuBaseTotals(items);
  const aiuPct = budget.aiuPercentage;
  const aiuPC = totals.aiuBasePC * (aiuPct / 100);
  const aiuPT = totals.aiuBasePT * (aiuPct / 100);
  const ivaPC = totals.aiuBasePC * (budget.utilidadPercentage / 100) * (budget.ivaUtilityPercentage / 100);
  const ivaPT = totals.aiuBasePT * (budget.utilidadPercentage / 100) * (budget.ivaUtilityPercentage / 100);

  return prisma.budget.update({
    where: { id: budgetId },
    data: {
      totalDirectCostPC: totals.aiuBasePC,
      totalDirectCostPT: totals.aiuBasePT,
      totalAIU_PC: aiuPC,
      totalAIU_PT: aiuPT,
      totalIvaUtilidad_PC: ivaPC,
      totalIvaUtilidad_PT: ivaPT,
      totalPC: totals.aiuBasePC + aiuPC + ivaPC + totals.tramitesPC,
      totalPT: totals.aiuBasePT + aiuPT + ivaPT + totals.tramitesPT,
    },
  });
}
