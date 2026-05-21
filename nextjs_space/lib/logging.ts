/**
 * Structured logging utility for cache, queue, and worker operations
 * Provides consistent log format across system
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  component: string;
  operation: string;
  requestId?: string;
  jobId?: string;
  projectId?: string;
  userId?: string;
  duration?: number;
  [key: string]: any;
}

function formatTimestamp(): string {
  return new Date().toISOString();
}

function colorizeLevel(level: LogLevel): string {
  const colors: Record<LogLevel, string> = {
    debug: '\x1b[36m',    // cyan
    info: '\x1b[32m',     // green
    warn: '\x1b[33m',     // yellow
    error: '\x1b[31m',    // red
  };
  const reset = '\x1b[0m';
  return `${colors[level]}[${level.toUpperCase()}]${reset}`;
}

function serializeContext(context: LogContext): string {
  const { component, operation, ...rest } = context;
  const parts = [component, operation];

  if (rest.requestId) parts.push(`req=${rest.requestId}`);
  if (rest.jobId) parts.push(`job=${rest.jobId}`);
  if (rest.projectId) parts.push(`project=${rest.projectId}`);
  if (rest.userId) parts.push(`user=${rest.userId}`);
  if (rest.duration !== undefined) parts.push(`${rest.duration}ms`);

  const remaining = Object.entries(rest)
    .filter(([k]) => !['requestId', 'jobId', 'projectId', 'userId', 'duration'].includes(k))
    .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
    .join(' ');

  return parts.join(' ') + (remaining ? ' ' + remaining : '');
}

function formatLog(level: LogLevel, context: LogContext, message: string, error?: Error): string {
  const timestamp = formatTimestamp();
  const levelStr = colorizeLevel(level);
  const contextStr = serializeContext(context);
  
  let logLine = `${timestamp} ${levelStr} ${contextStr}: ${message}`;
  
  if (error) {
    logLine += `\n  Error: ${error.message}`;
    if (error.stack) {
      logLine += `\n${error.stack}`;
    }
  }

  return logLine;
}

export function log(level: LogLevel, context: LogContext, message: string, error?: Error) {
  const formatted = formatLog(level, context, message, error);
  
  if (level === 'error') {
    console.error(formatted);
  } else if (level === 'warn') {
    console.warn(formatted);
  } else if (process.env.DEBUG) {
    console.log(formatted);
  } else if (level === 'info') {
    console.log(formatted);
  }
}

export function logDebug(context: LogContext, message: string) {
  log('debug', context, message);
}

export function logInfo(context: LogContext, message: string) {
  log('info', context, message);
}

export function logWarn(context: LogContext, message: string, error?: Error) {
  log('warn', context, message, error);
}

export function logError(context: LogContext, message: string, error?: Error) {
  log('error', context, message, error);
}

export function createLogger(component: string) {
  return {
    debug: (operation: string, context?: Omit<LogContext, 'component' | 'operation'>, message?: string) =>
      logDebug({ component, operation, ...context }, message || ''),
    info: (operation: string, context?: Omit<LogContext, 'component' | 'operation'>, message?: string) =>
      logInfo({ component, operation, ...context }, message || ''),
    warn: (operation: string, error?: Error, context?: Omit<LogContext, 'component' | 'operation'>) =>
      logWarn({ component, operation, ...context }, error?.message || 'Warning', error),
    error: (operation: string, error?: Error, context?: Omit<LogContext, 'component' | 'operation'>) =>
      logError({ component, operation, ...context }, error?.message || 'Error', error),
  };
}
