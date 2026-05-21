import { z } from 'zod';

/**
 * Request/Response validation schemas for API endpoints
 */

export const ProjectIdSchema = z.string().uuid().nullable();

export const FinancialReportJobRequestSchema = z.object({
  projectId: ProjectIdSchema.optional(),
  idempotencyKey: z.string().min(1).max(255).optional(),
});

export type FinancialReportJobRequest = z.infer<typeof FinancialReportJobRequestSchema>;

export const FinancialReportJobResponseSchema = z.object({
  id: z.string(),
  projectId: ProjectIdSchema,
  status: z.enum(['queued', 'processing', 'completed', 'failed']),
  createdAt: z.string().datetime(),
  startedAt: z.string().datetime().nullable(),
  finishedAt: z.string().datetime().nullable(),
  progress: z.number().min(0).max(100).optional(),
  error: z.string().nullable().optional(),
  result: z.unknown().optional(),
});

export type FinancialReportJobResponse = z.infer<typeof FinancialReportJobResponseSchema>;

export const ListJobsResponseSchema = z.array(
  FinancialReportJobResponseSchema.pick({
    id: true,
    projectId: true,
    status: true,
    createdAt: true,
    startedAt: true,
    finishedAt: true,
  })
);

export type ListJobsResponse = z.infer<typeof ListJobsResponseSchema>;

/**
 * Validate and parse a request, throwing on error
 */
export function validateRequest<T>(schema: z.ZodSchema<T>, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
      throw new ValidationError(`Invalid request: ${issues}`);
    }
    throw error;
  }
}

/**
 * Validate and parse a response, logging on error but not throwing
 */
export function validateResponse<T>(schema: z.ZodSchema<T>, data: unknown): T | null {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
      console.warn(`Invalid response: ${issues}`);
      return null;
    }
    throw error;
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}
