import { z } from "zod";

export const CreateWorkCutSchema = z.object({
  projectId: z.string(),
  contractorId: z.string(),
  costCenterId: z.string(),
  periodStart: z.string().datetime({ offset: true }).or(z.string().date()),
  periodEnd: z.string().datetime({ offset: true }).or(z.string().date()),
  requestedAmount: z.number().positive("El monto debe ser mayor a 0"),
  description: z.string().min(10, "Describa el corte de obra"),
}).refine(
  (d) => new Date(d.periodEnd) >= new Date(d.periodStart),
  { message: "La fecha fin debe ser igual o posterior a la fecha inicio", path: ["periodEnd"] }
);

export const ApproveWorkCutSchema = z.object({
  comments: z.string().optional(),
});

export const RejectWorkCutSchema = z.object({
  reason: z.string().min(5, "Indique el motivo del rechazo"),
});

export const WorkCutFilterSchema = z.object({
  projectId: z.string().optional(),
  contractorId: z.string().optional(),
  status: z.enum(["PENDING", "IN_REVIEW", "APPROVED", "REJECTED"]).optional(),
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(20),
});

export type CreateWorkCutInput = z.infer<typeof CreateWorkCutSchema>;
export type WorkCutFilterInput = z.infer<typeof WorkCutFilterSchema>;
