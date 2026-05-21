import { Queue, Worker } from 'bullmq';
import { buildFinancialReport } from '@/lib/financial-report';
import { createLogger } from '@/lib/logging';

export interface FinancialReportJobData {
  projectId: string | null;
}

export interface FinancialReportJobResult {
  projects: unknown[];
  totals: unknown;
  generatedAt: string;
}

const logger = createLogger('FinancialReportBullMQ');

let queue: Queue<FinancialReportJobData, FinancialReportJobResult> | null = null;
let worker: Worker<FinancialReportJobData, FinancialReportJobResult> | null = null;
let initialized = false;
let initError: Error | null = null;

const REDIS_URL = process.env.REDIS_URL;

function isQueueAvailable(): boolean {
  return !!REDIS_URL && !initError && initialized;
}

async function initializeQueue() {
  if (initialized || initError) {
    return;
  }

  if (!REDIS_URL) {
    logger.info('init_queue_disabled', {}, 'REDIS_URL not set, BullMQ queue disabled');
    initialized = true;
    return;
  }

  try {
    const { Queue: BullQueue, Worker: BullWorker } = await import('bullmq');

    queue = new BullQueue<FinancialReportJobData, FinancialReportJobResult>(
      'financial-reports',
      {
        connection: { url: REDIS_URL },
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: { age: 3600 },
          removeOnFail: { age: 86400 },
        },
      }
    );

    queue.on('error', (error) => {
      logger.error('queue_error', error as Error);
    });

    worker = new BullWorker<FinancialReportJobData, FinancialReportJobResult>(
      'financial-reports',
      async (job) => {
        logger.info('job_processing_start', 
          { jobId: job.id, projectId: job.data.projectId }, 
          'Starting job processing');
        try {
          const result = await buildFinancialReport(job.data.projectId);
          logger.info('job_processing_complete', 
            { jobId: job.id, projectId: job.data.projectId }, 
            'Job completed successfully');
          return result;
        } catch (error) {
          logger.error('job_processing_error', error as Error, 
            { jobId: job.id, projectId: job.data.projectId });
          throw error;
        }
      },
      {
        connection: { url: REDIS_URL },
        concurrency: Math.max(1, Number(process.env.FINANCIAL_REPORT_JOB_CONCURRENCY ?? 2)),
      }
    );

    worker.on('completed', (job, result) => {
      logger.debug('worker_job_completed', { jobId: job.id }, 'Worker job completed');
    });

    worker.on('failed', (job, error) => {
      logger.error('worker_job_failed', error, { jobId: job?.id });
    });

    logger.info('init_queue_success', {}, 'BullMQ queue initialized successfully');
    initialized = true;
  } catch (error) {
    initError = error as Error;
    logger.error('init_queue_error', error as Error, {
      fallback: 'in-memory',
    });
    console.info('Falling back to in-memory queue');
    initialized = true;
  }
}

export async function enqueueFinancialReportJobBullMQ(projectId: string | null) {
  await initializeQueue();

  if (!isQueueAvailable() || !queue) {
    logger.debug('enqueue_bullmq_skipped', { projectId }, 'BullMQ not available, will use fallback');
    return null;
  }

  try {
    const job = await queue.add(
      'generate-report',
      { projectId },
      {
        jobId: `report-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      }
    );

    logger.info('enqueue_bullmq_success', 
      { jobId: job.id, projectId }, 
      'Job enqueued to BullMQ');

    return {
      id: job.id ?? '',
      projectId,
      status: 'queued' as const,
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('enqueue_bullmq_error', error as Error, { projectId });
    return null;
  }
}

export async function getFinancialReportJobBullMQ(jobId: string) {
  await initializeQueue();

  if (!isQueueAvailable() || !queue) {
    logger.debug('get_job_bullmq_skipped', { jobId }, 'BullMQ not available');
    return null;
  }

  try {
    const job = await queue.getJob(jobId);
    if (!job) {
      logger.debug('get_job_bullmq_notfound', { jobId }, 'Job not found in BullMQ');
      return null;
    }

    const state = await job.getState();
    const progress = typeof job.progress === 'number' ? job.progress : 0;

    const result = {
      id: job.id ?? '',
      projectId: (job.data as FinancialReportJobData).projectId,
      status: (state === 'completed'
        ? 'completed'
        : state === 'failed'
          ? 'failed'
          : state === 'active'
            ? 'processing'
            : 'queued') as 'queued' | 'processing' | 'completed' | 'failed',
      createdAt: new Date(job.timestamp).toISOString(),
      startedAt:
        state === 'active' || state === 'completed' || state === 'failed'
          ? new Date(job.processedOn ?? job.timestamp).toISOString()
          : null,
      finishedAt:
        state === 'completed' || state === 'failed'
          ? new Date(job.finishedOn ?? Date.now()).toISOString()
          : null,
      progress: progress ?? 0,
      error: job.failedReason ?? null,
      result: job.returnvalue ?? null,
    };

    logger.debug('get_job_bullmq_found', { jobId, status: result.status }, 
      'Job retrieved from BullMQ');

    return result;
  } catch (error) {
    logger.error('get_job_bullmq_error', error as Error, { jobId });
    return null;
  }
}

export async function listFinancialReportJobsBullMQ(limit = 20) {
  await initializeQueue();

  if (!isQueueAvailable() || !queue) {
    logger.debug('list_jobs_bullmq_skipped', { limit }, 'BullMQ not available');
    return [];
  }

  try {
    const jobs = await queue.getJobs(['completed', 'failed', 'delayed', 'active', 'waiting'], 0, limit - 1);

    const results = await Promise.all(
      jobs.map(async (job) => {
        const state = await job.getState();
        return {
          id: job.id ?? '',
          projectId: (job.data as FinancialReportJobData).projectId,
          status: (state === 'completed'
            ? 'completed'
            : state === 'failed'
              ? 'failed'
              : state === 'active'
                ? 'processing'
                : 'queued') as 'queued' | 'processing' | 'completed' | 'failed',
          createdAt: new Date(job.timestamp).toISOString(),
          startedAt: job.processedOn ? new Date(job.processedOn).toISOString() : null,
          finishedAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : null,
        };
      })
    );

    logger.debug('list_jobs_bullmq_success', { count: results.length, limit }, 
      `Retrieved ${results.length} jobs from BullMQ`);

    return results;
  } catch (error) {
    logger.error('list_jobs_bullmq_error', error as Error, { limit });
    return [];
  }
}

export async function closeQueue() {
  if (worker) {
    await worker.close();
  }
  if (queue) {
    await queue.close();
  }
}
