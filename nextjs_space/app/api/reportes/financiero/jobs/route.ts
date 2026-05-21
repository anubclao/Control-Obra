import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options';
import {
  enqueueFinancialReportJob,
  listFinancialReportJobs,
} from '@/lib/financial-report-jobs';
import { ROLES_CAN_VIEW_FINANCIAL } from '@/lib/constants';
import { 
  FinancialReportJobRequestSchema, 
  validateRequest, 
  ValidationError 
} from '@/lib/validation';
import { createLogger } from '@/lib/logging';
import { clearRuntimeCache } from '@/lib/runtime-cache';

const logger = createLogger('FinancialReportJobsEndpoint');

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      logger.warn('get_jobs_unauthorized', undefined, { userId: 'anonymous' });
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const userRole = session.user.role;
    if (!ROLES_CAN_VIEW_FINANCIAL.includes(userRole as (typeof ROLES_CAN_VIEW_FINANCIAL)[number])) {
      logger.warn('get_jobs_forbidden', undefined, { userId: session.user.id, userRole });
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get('limit') ?? 20);
    const safeLimit = Math.min(Math.max(limit, 1), 100);

    logger.info('get_jobs', { userId: session.user.id, limit: safeLimit }, 'Fetching job list');

    const jobs = await listFinancialReportJobs(safeLimit);

    return NextResponse.json({ jobs }, { status: 200 });
  } catch (error) {
    logger.error('get_jobs_error', error as Error);
    return NextResponse.json({ error: 'Error al listar jobs de reportes' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      logger.warn('post_job_unauthorized', undefined, { userId: 'anonymous' });
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const userRole = session.user.role;
    if (!ROLES_CAN_VIEW_FINANCIAL.includes(userRole as (typeof ROLES_CAN_VIEW_FINANCIAL)[number])) {
      logger.warn('post_job_forbidden', undefined, { userId: session.user.id, userRole });
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    // Validate request
    const body = await request.json().catch(() => ({}));
    const validated = validateRequest(FinancialReportJobRequestSchema, body);

    logger.info('post_job_validated', 
      { userId: session.user.id, projectId: validated.projectId }, 
      'Creating financial report job');

    // Clear cache BEFORE enqueueing (atomic operation)
    if (validated.projectId) {
      await clearRuntimeCache(`financial-report:${validated.projectId}`);
      logger.debug('post_job_cache_clear', { projectId: validated.projectId }, 'Cache cleared');
    }

    // Enqueue job with idempotency
    const job = await enqueueFinancialReportJob(validated.projectId ?? null, validated.idempotencyKey);

    logger.info('post_job_created', 
      { userId: session.user.id, jobId: job.id, projectId: job.projectId }, 
      'Job created successfully');

    return NextResponse.json(
      {
        id: job.id,
        status: job.status,
        projectId: job.projectId,
        createdAt: job.createdAt,
      },
      { status: 202 }
    );
  } catch (error) {
    if (error instanceof ValidationError) {
      logger.warn('post_job_validation_error', undefined, { error: error.message });
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    logger.error('post_job_error', error as Error);
    return NextResponse.json({ error: 'Error al crear job de reporte financiero' }, { status: 500 });
  }
}
