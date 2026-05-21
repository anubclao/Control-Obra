export interface BudgetItemForAiu {
  itemNumber?: string | null;
  description?: string | null;
  totalPC: number;
  totalPT: number;
}

export interface AiuBaseTotals {
  directCostPC: number;
  directCostPT: number;
  aiuBasePC: number;
  aiuBasePT: number;
  tramitesPC: number;
  tramitesPT: number;
  excludedFromAiuPC: number;
  excludedFromAiuPT: number;
}

function normalizeText(value?: string | null): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

export function isTramiteReference(itemNumber?: string | null, description?: string | null): boolean {
  const itemText = normalizeText(itemNumber);
  const descriptionText = normalizeText(description);

  return itemText.includes("TRAMITE") || descriptionText.includes("TRAMITE");
}

export function calculateAiuBaseTotals(items: BudgetItemForAiu[]): AiuBaseTotals {
  let directCostPC = 0;
  let directCostPT = 0;
  let aiuBasePC = 0;
  let aiuBasePT = 0;
  let tramitesPC = 0;
  let tramitesPT = 0;

  for (const item of items) {
    const totalPC = item.totalPC || 0;
    const totalPT = item.totalPT || 0;

    directCostPC += totalPC;
    directCostPT += totalPT;

    if (!isTramiteReference(item.itemNumber, item.description)) {
      aiuBasePC += totalPC;
      aiuBasePT += totalPT;
    } else {
      tramitesPC += totalPC;
      tramitesPT += totalPT;
    }
  }

  return {
    directCostPC,
    directCostPT,
    aiuBasePC,
    aiuBasePT,
    tramitesPC,
    tramitesPT,
    excludedFromAiuPC: directCostPC - aiuBasePC,
    excludedFromAiuPT: directCostPT - aiuBasePT,
  };
}
