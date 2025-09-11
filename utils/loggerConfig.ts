// utils/loggerConfig.ts
// Development logging configuration

import { 
  setLogLevel, 
  LogLevel, 
  enableDevelopmentLogging, 
  enableMinimalLogging 
} from './logger';

// Development logging preferences
export const LOGGING_CONFIG = {
  // Set to true to enable all logs during development
  VERBOSE_LOGGING: true,
  
  // Set to true to enable performance logging
  PERFORMANCE_LOGGING: true,
  
  // Set to true to enable security event logging
  SECURITY_LOGGING: true,
  
  // Set to true to log API requests/responses
  API_LOGGING: false,
  
  // Set to true to log navigation events
  NAVIGATION_LOGGING: false,
};

/**
 * Initialize development logging based on configuration
 */
export function initializeDevelopmentLogging(): void {
  if (__DEV__) {
    if (LOGGING_CONFIG.VERBOSE_LOGGING) {
      enableDevelopmentLogging();
    } else {
      enableMinimalLogging();
    }
    
    console.log('🔧 Development logging configured:', {
      verbose: LOGGING_CONFIG.VERBOSE_LOGGING,
      performance: LOGGING_CONFIG.PERFORMANCE_LOGGING,
      security: LOGGING_CONFIG.SECURITY_LOGGING,
      api: LOGGING_CONFIG.API_LOGGING,
      navigation: LOGGING_CONFIG.NAVIGATION_LOGGING,
    });
  }
}

/**
 * Toggle verbose logging on/off during development
 */
export function toggleVerboseLogging(): void {
  if (__DEV__) {
    LOGGING_CONFIG.VERBOSE_LOGGING = !LOGGING_CONFIG.VERBOSE_LOGGING;
    if (LOGGING_CONFIG.VERBOSE_LOGGING) {
      enableDevelopmentLogging();
    } else {
      enableMinimalLogging();
    }
    console.log('🔧 Verbose logging:', LOGGING_CONFIG.VERBOSE_LOGGING ? 'ON' : 'OFF');
  }
}

// Auto-initialize development logging
if (__DEV__) {
  initializeDevelopmentLogging();
}
