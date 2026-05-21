import { Worker } from 'bullmq';
import { buildFinancialReport } from '../lib/financial-report';

const REDIS_URL = process.env.REDIS_URL;
const JOB_CONCURRENCY = Math.max(1, Number(process.env.FINANCIAL_REPORT_JOB_CONCURRENCY ?? 2));

if (!REDIS_URL) {
  console.error('REDIS_URL is not set. Worker requires Redis to be configured.');
  process.exit(1);
}

const worker = new Worker(
  'financial-reports',
  async (job) => {
    console.log(`[${new Date().toISOString()}] Processing job ${job.id} for project ${job.data.projectId}`);
    try {
      const result = await buildFinancialReport(job.data.projectId);
      console.log(`[${new Date().toISOString()}] Job ${job.id} completed successfully`);
      return result;
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Job ${job.id} failed:`, error);
      throw error;
    }
  },
  {
    connection: { url: REDIS_URL },
    concurrency: JOB_CONCURRENCY,
  }
);

worker.on('completed', (job) => {
  console.log(`[${new Date().toISOString()}] Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`[${new Date().toISOString()}] Job ${job?.id} failed:`, err);
});

worker.on('error', (error) => {
  console.error(`[${new Date().toISOString()}] Worker error:`, error);
});

process.on('SIGTERM', async () => {
  console.log(`[${new Date().toISOString()}] SIGTERM received, shutting down gracefully...`);
  await worker.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log(`[${new Date().toISOString()}] SIGINT received, shutting down gracefully...`);
  await worker.close();
  process.exit(0);
});

console.log(`[${new Date().toISOString()}] Financial Report Worker started with concurrency=${JOB_CONCURRENCY}`);
