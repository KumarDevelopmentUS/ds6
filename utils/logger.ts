// utils/logger.ts
import { Platform } from 'react-native';

// Log levels
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

// Environment-based logging configuration
const isDevelopment = __DEV__ || process.env.NODE_ENV === 'development';
const isProduction = !isDevelopment;

// Default log level based on environment
const DEFAULT_LOG_LEVEL = isDevelopment ? LogLevel.DEBUG : LogLevel.ERROR;

// Current log level (can be overridden)
let currentLogLevel = DEFAULT_LOG_LEVEL;

/**
 * Set the current log level
 */
export function setLogLevel(level: LogLevel): void {
  currentLogLevel = level;
}

/**
 * Get the current log level
 */
export function getLogLevel(): LogLevel {
  return currentLogLevel;
}

/**
 * Check if a log level should be output
 */
function shouldLog(level: LogLevel): boolean {
  return level <= currentLogLevel;
}

/**
 * Format log message with timestamp and level
 */
function formatMessage(level: string, message: string, ...args: any[]): string {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level}]`;
  
  if (args.length > 0) {
    return `${prefix} ${message} ${args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ')}`;
  }
  
  return `${prefix} ${message}`;
}

/**
 * Error logging - always enabled in production
 */
export function logError(message: string, ...args: any[]): void {
  if (shouldLog(LogLevel.ERROR)) {
    const formattedMessage = formatMessage('ERROR', message, ...args);
    console.error(formattedMessage);
  }
}

/**
 * Warning logging
 */
export function logWarn(message: string, ...args: any[]): void {
  if (shouldLog(LogLevel.WARN)) {
    const formattedMessage = formatMessage('WARN', message, ...args);
    console.warn(formattedMessage);
  }
}

/**
 * Info logging - disabled in production
 */
export function logInfo(message: string, ...args: any[]): void {
  if (shouldLog(LogLevel.INFO)) {
    const formattedMessage = formatMessage('INFO', message, ...args);
    console.log(formattedMessage);
  }
}

/**
 * Debug logging - only in development
 */
export function logDebug(message: string, ...args: any[]): void {
  if (shouldLog(LogLevel.DEBUG)) {
    const formattedMessage = formatMessage('DEBUG', message, ...args);
    console.log(formattedMessage);
  }
}

/**
 * Security logging - for security-related events
 */
export function logSecurity(message: string, ...args: any[]): void {
  // Security logs should always be output, but sanitized
  const sanitizedArgs = args.map(arg => {
    if (typeof arg === 'object' && arg !== null) {
      // Remove sensitive fields
      const sanitized = { ...arg };
      delete sanitized.password;
      delete sanitized.token;
      delete sanitized.email;
      delete sanitized.secret;
      delete sanitized.key;
      return sanitized;
    }
    return arg;
  });
  
  const formattedMessage = formatMessage('SECURITY', message, ...sanitizedArgs);
  console.log(formattedMessage);
}

/**
 * Performance logging - for performance monitoring
 */
export function logPerformance(message: string, ...args: any[]): void {
  if (isDevelopment) {
    const formattedMessage = formatMessage('PERF', message, ...args);
    console.log(formattedMessage);
  }
}

/**
 * Initialize logger based on environment
 */
export function initializeLogger(): void {
  if (isProduction) {
    setLogLevel(LogLevel.ERROR);
    logInfo('Logger initialized for production - only errors will be logged');
  } else {
    setLogLevel(LogLevel.DEBUG);
    logInfo('Logger initialized for development - all logs enabled');
  }
}

// Auto-initialize logger
initializeLogger();
