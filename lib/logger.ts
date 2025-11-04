/**
 * Common logger utility for structured logging across the application
 */

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogContext {
  [key: string]: any;
}

/**
 * Format timestamp for logging
 */
function formatTimestamp(): string {
  return new Date().toISOString().replace('T', ' ').split('.')[0];
}

/**
 * Format log message with timestamp, module, level, and optional context
 */
function formatLogMessage(
  module: string,
  level: LogLevel,
  message: string,
  context?: LogContext
): string {
  const timestamp = formatTimestamp();
  const levelStr = level.toUpperCase().padEnd(5);
  const moduleStr = module.padEnd(15);
  const contextStr = context ? ` ${JSON.stringify(context)}` : '';
  return `[${timestamp}] [${moduleStr}] [${levelStr}] ${message}${contextStr}`;
}

/**
 * Create a logger instance for a specific module
 */
export function createLogger(module: string) {
  return {
    info: (message: string, context?: LogContext) => {
      console.log(formatLogMessage(module, 'info', message, context));
    },
    warn: (message: string, context?: LogContext) => {
      console.warn(formatLogMessage(module, 'warn', message, context));
    },
    error: (message: string, context?: LogContext) => {
      console.error(formatLogMessage(module, 'error', message, context));
    },
    debug: (message: string, context?: LogContext) => {
      console.log(formatLogMessage(module, 'debug', message, context));
    },
  };
}

/**
 * Default logger (no module prefix)
 */
export const logger = createLogger('app');
