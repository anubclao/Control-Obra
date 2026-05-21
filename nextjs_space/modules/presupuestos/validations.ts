import { z } from "zod";

export const UpdateBudgetAIUSchema = z.object({
  adminPercentage: z.number().min(0).max(100),
  imprevistoPercentage: z.number().min(0).max(100),
  utilidadPercentage: z.number().min(0).max(100),
  ivaUtilityPercentage: z.number().min(0).max(100),
});

export const CreateBudgetLayerSchema = z.object({
  code: z.string().min(1).max(10).toUpperCase(),
  name: z.string().min(2).max(100),
  order: z.number().int().default(0),
});

export const CreateBudgetItemSchema = z.object({
  layerId: z.string(),
  itemNumber: z.string(),
  description: z.string().min(2),
  unit: z.string().min(1).max(20),
  quantity: z.number().positive(),
  unitPricePC: z.number().min(0),
  unitPricePT: z.number().min(0),
});

export const UpdateBudgetItemSchema = CreateBudgetItemSchema.partial().omit({ layerId: true });

export const BudgetFilterSchema = z.object({
  projectId: z.string(),
  layerId: z.string().optional(),
  status: z.enum(["GREEN", "YELLOW", "RED"]).optional(),
  search: z.string().optional(),
});

export type UpdateBudgetAIUInput = z.infer<typeof UpdateBudgetAIUSchema>;
export type CreateBudgetLayerInput = z.infer<typeof CreateBudgetLayerSchema>;
export type CreateBudgetItemInput = z.infer<typeof CreateBudgetItemSchema>;
export type BudgetFilterInput = z.infer<typeof BudgetFilterSchema>;
