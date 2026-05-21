import { z } from "zod";

const ColombianNIT = z.string().regex(/^\d{6,10}-?\d$/, "NIT inválido (ej: 900123456-7)");

export const CreateContractorSchema = z.object({
  name: z.string().min(3, "Mínimo 3 caracteres"),
  nit: ColombianNIT,
  contact: z.string().min(3),
  email: z.string().email("Email inválido"),
  phone: z.string().min(7, "Teléfono inválido"),
  address: z.string().optional(),
  city: z.string().optional(),
  department: z.string().optional(),
  postalCode: z.string().optional(),
  website: z.string().url().optional().or(z.literal("")),
  legalRepName: z.string().optional(),
  legalRepEmail: z.string().email().optional().or(z.literal("")),
  legalRepPhone: z.string().optional(),
  legalRepCedula: z.string().optional(),
  reportedIncome: z.number().optional(),
  incomeYear: z.number().int().optional(),
  ref1Name: z.string().optional(),
  ref1Company: z.string().optional(),
  ref1Phone: z.string().optional(),
  ref1Email: z.string().email().optional().or(z.literal("")),
  ref2Name: z.string().optional(),
  ref2Company: z.string().optional(),
  ref2Phone: z.string().optional(),
  ref2Email: z.string().email().optional().or(z.literal("")),
  ref3Name: z.string().optional(),
  ref3Company: z.string().optional(),
  ref3Phone: z.string().optional(),
  ref3Email: z.string().email().optional().or(z.literal("")),
});

export const UpdateContractorSchema = CreateContractorSchema.partial();

export const ContractorFilterSchema = z.object({
  status: z.enum(["COMPLETE", "INCOMPLETE", "EXPIRED"]).optional(),
  search: z.string().optional(),
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(20),
});

export type CreateContractorInput = z.infer<typeof CreateContractorSchema>;
export type ContractorFilterInput = z.infer<typeof ContractorFilterSchema>;
