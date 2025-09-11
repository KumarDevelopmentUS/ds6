// utils/csrfProtection.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// CSRF token storage key
const CSRF_TOKEN_KEY = 'csrf_token';

/**
 * Generate a simple CSRF token
 */
function generateCSRFToken(): string {
  const timestamp = Date.now().toString();
  const random = Math.random().toString(36).substring(2);
  return `${timestamp}_${random}`;
}

/**
 * Get or create CSRF token
 */
export async function getCSRFToken(): Promise<string> {
  try {
    let token = await AsyncStorage.getItem(CSRF_TOKEN_KEY);
    
    if (!token) {
      token = generateCSRFToken();
      await AsyncStorage.setItem(CSRF_TOKEN_KEY, token);
    }
    
    return token;
  } catch (error) {
    console.error('Error getting CSRF token:', error);
    // Fallback to generating a new token
    return generateCSRFToken();
  }
}

/**
 * Validate CSRF token
 */
export async function validateCSRFToken(token: string): Promise<boolean> {
  try {
    const storedToken = await AsyncStorage.getItem(CSRF_TOKEN_KEY);
    return storedToken === token;
  } catch (error) {
    console.error('Error validating CSRF token:', error);
    return false;
  }
}

/**
 * Refresh CSRF token
 */
export async function refreshCSRFToken(): Promise<string> {
  try {
    const newToken = generateCSRFToken();
    await AsyncStorage.setItem(CSRF_TOKEN_KEY, newToken);
    return newToken;
  } catch (error) {
    console.error('Error refreshing CSRF token:', error);
    return generateCSRFToken();
  }
}

/**
 * Clear CSRF token (for logout)
 */
export async function clearCSRFToken(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CSRF_TOKEN_KEY);
  } catch (error) {
    console.error('Error clearing CSRF token:', error);
  }
}

/**
 * Add CSRF protection to requests
 */
export async function addCSRFProtection(headers: Record<string, string> = {}): Promise<Record<string, string>> {
  try {
    const token = await getCSRFToken();
    return {
      ...headers,
      'X-CSRF-Token': token,
      'X-Requested-With': 'XMLHttpRequest', // Helps identify AJAX requests
    };
  } catch (error) {
    console.error('Error adding CSRF protection:', error);
    return headers;
  }
}

/**
 * Validate request origin (basic check)
 */
export function validateRequestOrigin(origin?: string): boolean {
  if (Platform.OS === 'web') {
    // For web, check against allowed origins
    const allowedOrigins = [
      'https://diestats.app',
      'http://localhost:3000', // Development
      'http://localhost:8081', // Expo dev server
    ];
    
    if (!origin) return false;
    return allowedOrigins.some(allowed => origin.startsWith(allowed));
  }
  
  // For mobile apps, origin validation is less critical
  return true;
}
