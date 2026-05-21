import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options';
import { getFinancialReportJob } from '@/lib/financial-report-jobs';
import { ROLES_CAN_VIEW_FINANCIAL } from '@/lib/constants';
import { createLogger } from '@/lib/logging';
import { z } from 'zod';

const logger = createLogger('FinancialReportJobDetailEndpoint');

const JobIdSchema = z.string().uuid('Invalid job ID format');

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      logger.warn('get_job_detail_unauthorized', undefined, { userId: 'anonymous' });
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const userRole = session.user.role;
    if (!ROLES_CAN_VIEW_FINANCIAL.includes(userRole as (typeof ROLES_CAN_VIEW_FINANCIAL)[number])) {
      logger.warn('get_job_detail_forbidden', undefined, { userId: session.user.id, userRole });
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const { id } = await params;

    // Validate job ID format
    try {
      JobIdSchema.parse(id);
    } catch (error) {
      logger.warn('get_job_detail_invalid_id', undefined, { jobId: id });
      return NextResponse.json({ error: 'Formato de ID de job inválido' }, { status: 400 });
    }

    logger.debug('get_job_detail', { userId: session.user.id, jobId: id }, 'Fetching job details');

    const job = await getFinancialReportJob(id);

    if (!job) {
      logger.info('get_job_detail_notfound', { jobId: id }, 'Job not found');
      return NextResponse.json({ error: 'Job no encontrado' }, { status: 404 });
    }

    logger.info('get_job_detail_found', 
      { userId: session.user.id, jobId: id, status: job.status }, 
      'Job details retrieved');

    return NextResponse.json(job, { status: 200 });
  } catch (error) {
    logger.error('get_job_detail_error', error as Error);
    return NextResponse.json({ error: 'Error al consultar job de reporte financiero' }, { status: 500 });
  }
}
