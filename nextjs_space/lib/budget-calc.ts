// Helper para cálculos de presupuesto con AIU discriminado

export interface BudgetCalcInput {
  directCost: number;
  adminPercentage: number;
  imprevistoPercentage: number;
  utilidadPercentage: number;
  ivaUtilityPercentage: number;
}

export interface BudgetCalcResult {
  admin: number;
  imprevistos: number;
  utilidad: number;
  totalAIU: number;
  ivaUtilidad: number;
  total: number; // directCost + totalAIU + ivaUtilidad
}

export function calculateBudgetTotals(input: BudgetCalcInput): BudgetCalcResult {
  const { directCost, adminPercentage, imprevistoPercentage, utilidadPercentage, ivaUtilityPercentage } = input;
  
  const admin = directCost * (adminPercentage / 100);
  const imprevistos = directCost * (imprevistoPercentage / 100);
  const utilidad = directCost * (utilidadPercentage / 100);
  const totalAIU = admin + imprevistos + utilidad;
  const ivaUtilidad = utilidad * (ivaUtilityPercentage / 100);
  const total = directCost + totalAIU + ivaUtilidad;
  
  return { admin, imprevistos, utilidad, totalAIU, ivaUtilidad, total };
}
