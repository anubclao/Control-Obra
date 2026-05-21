import { randomUUID } from 'crypto';
import { buildFinancialReport } from '@/lib/financial-report';
import { 
  enqueueFinancialReportJobBullMQ,
  getFinancialReportJobBullMQ,
  listFinancialReportJobsBullMQ,
} from '@/lib/financial-report-queue-bullmq';
import { createLogger } from '@/lib/logging';
import {
  getOrCreateIdempotencyKey,
  getIdempotentJobId,
  storeIdempotencyKey,
} from '@/lib/idempotency';

export type FinancialReportJobStatus = 'queued' | 'processing' | 'completed' | 'failed';

export type FinancialReportJob = {
  id: string;
  projectId: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  status: FinancialReportJobStatus;
  error: string | null;
  result: unknown;
};

const JOB_MAX_HISTORY = Number(process.env.FINANCIAL_REPORT_JOB_HISTORY ?? 200);
const JOB_CONCURRENCY = Math.max(1, Number(process.env.FINANCIAL_REPORT_JOB_CONCURRENCY ?? 2));

const jobs = new Map<string, FinancialReportJob>();
const queue: string[] = [];
let activeWorkers = 0;

const logger = createLogger('FinancialReportQueue');

function trimHistory() {
  if (jobs.size <= JOB_MAX_HISTORY) {
    return;
  }

  const overflow = jobs.size - JOB_MAX_HISTORY;
  const ordered = [...jobs.values()].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  for (let i = 0; i < overflow; i++) {
    jobs.delete(ordered[i].id);
  }
}

async function processQueue() {
  while (activeWorkers < JOB_CONCURRENCY && queue.length > 0) {
    const jobId = queue.shift();
    if (!jobId) {
      return;
    }

    const job = jobs.get(jobId);
    if (!job || job.status !== 'queued') {
      continue;
    }

    activeWorkers++;
    job.status = 'processing';
    job.startedAt = new Date().toISOString();

    logger.info('process_job_start', { jobId, projectId: job.projectId }, 'Job processing started');

    Promise.resolve()
      .then(async () => {
        try {
          const result = await buildFinancialReport(job.projectId);
          job.result = result;
          job.status = 'completed';
          logger.info('process_job_complete', { jobId, projectId: job.projectId }, 'Job completed successfully');
        } catch (error) {
          job.status = 'failed';
          job.error = error instanceof Error ? error.message : 'Unknown job error';
          logger.error('process_job_error', error as Error, { jobId, projectId: job.projectId });
        }
      })
      .finally(() => {
        job.finishedAt = new Date().toISOString();
        activeWorkers--;
        trimHistory();
        void processQueue();
      });
  }
}

export async function enqueueFinancialReportJob(
  projectId: string | null,
  idempotencyKey?: string
) {
  // Generate or use provided idempotency key
  const key = getOrCreateIdempotencyKey(idempotencyKey, projectId);
  
  // Check if we already have a job for this idempotency key
  const existingJobId = getIdempotentJobId(key);
  if (existingJobId) {
    const existingJob = jobs.get(existingJobId);
    if (existingJob) {
      logger.info('idempotent_job_reuse', { jobId: existingJobId, projectId }, 
        'Returning existing job for idempotency key');
      return existingJob;
    }
  }

  // Try BullMQ first if available
  const bullJob = await enqueueFinancialReportJobBullMQ(projectId);
  
  if (bullJob) {
    storeIdempotencyKey(key, bullJob.id);
    logger.info('job_enqueued_bullmq', { jobId: bullJob.id, projectId }, 
      'Job enqueued to BullMQ');
    return bullJob;
  }

  // Fallback to in-memory queue
  const id = randomUUID();
  const now = new Date().toISOString();

  const job: FinancialReportJob = {
    id,
    projectId,
    createdAt: now,
    startedAt: null,
    finishedAt: null,
    status: 'queued',
    error: null,
    result: null,
  };

  jobs.set(id, job);
  queue.push(id);
  storeIdempotencyKey(key, id);
  
  logger.info('job_enqueued_memory', { jobId: id, projectId }, 
    'Job enqueued to in-memory queue');
  
  void processQueue();

  return job;
}

export async function getFinancialReportJob(jobId: string) {
  const bullJob = await getFinancialReportJobBullMQ(jobId);
  if (bullJob) {
    logger.debug('get_job_bullmq', { jobId }, 'Retrieved job from BullMQ');
    return bullJob;
  }

  const memoryJob = jobs.get(jobId) ?? null;
  if (memoryJob) {
    logger.debug('get_job_memory', { jobId }, 'Retrieved job from memory');
  } else {
    logger.warn('get_job_notfound', undefined, { jobId });
  }
  
  return memoryJob;
}

export async function listFinancialReportJobs(limit = 20) {
  const bullJobs = await listFinancialReportJobsBullMQ(limit);
  if (bullJobs.length > 0) {
    logger.debug('list_jobs_bullmq', { count: bullJobs.length, limit }, 
      `Retrieved ${bullJobs.length} jobs from BullMQ`);
    return bullJobs;
  }

  const memoryJobs = [...jobs.values()]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
  
  logger.debug('list_jobs_memory', { count: memoryJobs.length, limit }, 
    `Retrieved ${memoryJobs.length} jobs from memory`);
  
  return memoryJobs;
}
