// utils/logger.ts

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
      // Remove sensitive fields with comprehensive sanitization
      const sanitized = { ...arg };
      const sensitiveFields = [
        'password', 'token', 'email', 'secret', 'key', 'auth', 'session',
        'credential', 'apiKey', 'accessToken', 'refreshToken', 'jwt',
        'privateKey', 'publicKey', 'signature', 'hash', 'salt'
      ];
      
      sensitiveFields.forEach(field => {
        delete sanitized[field];
        // Also check for nested objects
        Object.keys(sanitized).forEach(key => {
          if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
            delete sanitized[key][field];
          }
        });
      });
      
      return sanitized;
    }
    
    // Sanitize strings that might contain sensitive data
    if (typeof arg === 'string') {
      // Remove potential email addresses
      const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
      let sanitized = arg.replace(emailRegex, '[EMAIL_REDACTED]');
      
      // Remove potential tokens (long alphanumeric strings)
      const tokenRegex = /\b[A-Za-z0-9]{20,}\b/g;
      sanitized = sanitized.replace(tokenRegex, '[TOKEN_REDACTED]');
      
      return sanitized;
    }
    
    return arg;
  });
  
  const formattedMessage = formatMessage('SECURITY', message, ...sanitizedArgs);
  
  // In production, only log to console if it's a critical security event
  if (isProduction) {
    // Only log critical security events in production
    if (message.toLowerCase().includes('error') || message.toLowerCase().includes('failed')) {
      console.error(formattedMessage);
    }
  } else {
    console.log(formattedMessage);
  }
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

/**
 * Development helper - enable all logs for debugging
 */
export function enableDevelopmentLogging(): void {
  if (isDevelopment) {
    setLogLevel(LogLevel.DEBUG);
    logInfo('Development logging enabled - all log levels active');
  }
}

/**
 * Development helper - enable only important logs
 */
export function enableMinimalLogging(): void {
  if (isDevelopment) {
    setLogLevel(LogLevel.WARN);
    logInfo('Minimal logging enabled - only warnings and errors');
  }
}

// Auto-initialize logger
initializeLogger();
