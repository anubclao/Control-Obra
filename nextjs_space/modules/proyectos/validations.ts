import { z } from "zod";

const BaseProjectSchema = z.object({
  name: z.string().min(3, "Mínimo 3 caracteres").max(200),
  client: z.string().min(2, "Nombre del cliente requerido"),
  location: z.string().optional(),
  startDate: z.string().datetime({ offset: true }).or(z.string().date()),
  estimatedEndDate: z.string().datetime({ offset: true }).or(z.string().date()),
  totalBudget: z.number().positive("El presupuesto debe ser mayor a 0"),
  description: z.string().optional(),
});

export const CreateProjectSchema = BaseProjectSchema.refine(
  (data) => new Date(data.estimatedEndDate) > new Date(data.startDate),
  { message: "La fecha de fin debe ser posterior a la de inicio", path: ["estimatedEndDate"] }
);

export const UpdateProjectSchema = BaseProjectSchema.partial().extend({
  status: z.enum(["IN_PLANNING", "IN_EXECUTION", "PAUSED", "COMPLETED"]).optional(),
});

export const ProjectFilterSchema = z.object({
  status: z.enum(["IN_PLANNING", "IN_EXECUTION", "PAUSED", "COMPLETED"]).optional(),
  search: z.string().optional(),
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(20),
});

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;
export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;
export type ProjectFilterInput = z.infer<typeof ProjectFilterSchema>;
