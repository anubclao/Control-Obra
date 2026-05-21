import { z } from "zod";

export const CreatePaymentSchema = z.object({
  projectId: z.string().cuid("ID de proyecto inválido"),
  concept: z.string().min(5, "Describa el concepto (mín. 5 caracteres)"),
  amount: z.number().positive("El monto debe ser mayor a 0"),
  paymentType: z.enum(["CORTE_OBRA", "ANTICIPO", "RETENCION", "SUMINISTRO", "SERVICIOS", "HONORARIOS", "OTROS"]),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
  contractorId: z.string().optional(),
  workCutId: z.string().optional(),
  contractId: z.string().optional(),
  beneficiaryName: z.string().optional(),
  beneficiaryNit: z.string().optional(),
  bankName: z.string().optional(),
  accountType: z.string().optional(),
  accountNumber: z.string().optional(),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
  requiredApprovalLevel: z.number().int().min(1).max(3).default(2),
});

export const ApprovePaymentSchema = z.object({
  comments: z.string().optional(),
});

export const RejectPaymentSchema = z.object({
  reason: z.string().min(5, "Indique el motivo del rechazo"),
});

export const PaymentFilterSchema = z.object({
  projectId: z.string().optional(),
  status: z.enum(["PENDING", "APPROVED_LEVEL_1", "APPROVED_LEVEL_2", "APPROVED", "REJECTED", "PAID", "CANCELLED"]).optional(),
  paymentType: z.enum(["CORTE_OBRA", "ANTICIPO", "RETENCION", "SUMINISTRO", "SERVICIOS", "HONORARIOS", "OTROS"]).optional(),
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(20),
});

export type CreatePaymentInput = z.infer<typeof CreatePaymentSchema>;
export type PaymentFilterInput = z.infer<typeof PaymentFilterSchema>;
