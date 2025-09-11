// utils/passwordReset.ts
import { supabase } from '@/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logError, logInfo, logSecurity } from './logger';

export interface PasswordResetResult {
  success: boolean;
  message: string;
  error?: string;
}

// Rate limiting configuration
const RATE_LIMIT_KEY = 'password_reset_rate_limit';
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 3; // Maximum 3 attempts per 15 minutes

interface RateLimitData {
  attempts: number;
  lastAttempt: number;
}

/**
 * Check if user has exceeded rate limit for password reset
 */
async function checkRateLimit(): Promise<{ allowed: boolean; remainingTime?: number }> {
  try {
    const stored = await AsyncStorage.getItem(RATE_LIMIT_KEY);
    const now = Date.now();
    
    if (!stored) {
      return { allowed: true };
    }
    
    const rateLimitData: RateLimitData = JSON.parse(stored);
    
    // If window has expired, reset
    if (now - rateLimitData.lastAttempt > RATE_LIMIT_WINDOW) {
      await AsyncStorage.removeItem(RATE_LIMIT_KEY);
      return { allowed: true };
    }
    
    // Check if max attempts reached
    if (rateLimitData.attempts >= MAX_ATTEMPTS) {
      const remainingTime = Math.ceil((RATE_LIMIT_WINDOW - (now - rateLimitData.lastAttempt)) / 60000);
      return { allowed: false, remainingTime };
    }
    
    return { allowed: true };
  } catch (error) {
    logError('Error checking rate limit:', error);
    return { allowed: true }; // Allow on error to avoid blocking legitimate users
  }
}

/**
 * Record a password reset attempt
 */
async function recordAttempt(): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(RATE_LIMIT_KEY);
    const now = Date.now();
    
    let rateLimitData: RateLimitData;
    
    if (!stored) {
      rateLimitData = { attempts: 1, lastAttempt: now };
    } else {
      rateLimitData = JSON.parse(stored);
      
      // If window has expired, reset
      if (now - rateLimitData.lastAttempt > RATE_LIMIT_WINDOW) {
        rateLimitData = { attempts: 1, lastAttempt: now };
      } else {
        rateLimitData.attempts += 1;
        rateLimitData.lastAttempt = now;
      }
    }
    
    await AsyncStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(rateLimitData));
  } catch (error) {
    logError('Error recording rate limit attempt:', error);
  }
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(email: string): Promise<PasswordResetResult> {
  try {
    // Check rate limit first
    const rateLimitCheck = await checkRateLimit();
    if (!rateLimitCheck.allowed) {
      return {
        success: false,
        message: `Too many password reset attempts. Please wait ${rateLimitCheck.remainingTime} minutes before trying again.`,
        error: 'Rate limit exceeded'
      };
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return {
        success: false,
        message: 'Please enter a valid email address',
        error: 'Invalid email format'
      };
    }

    logSecurity('Sending password reset email');
    
    // Send password reset email
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://diestats.app/auth/reset-password',
    });

    logSecurity('Password reset response received');

    if (error) {
      logError('Password reset error:', error.message);
      
      // Record attempt even on failure to prevent abuse
      await recordAttempt();
      
      // Provide user-friendly error messages
      let userFriendlyMessage = 'Failed to send password reset email. Please try again.';
      
      if (error.message.includes('User not found')) {
        userFriendlyMessage = 'No account found with this email address.';
      } else if (error.message.includes('Too many requests')) {
        userFriendlyMessage = 'Too many requests. Please wait a moment before trying again.';
      } else if (error.message.includes('Email rate limit exceeded')) {
        userFriendlyMessage = 'Too many password reset attempts. Please wait before trying again.';
      }
      
      return {
        success: false,
        message: userFriendlyMessage,
        error: error.message
      };
    }

    // Record successful attempt
    await recordAttempt();
    logSecurity('Password reset email sent successfully');
    return {
      success: true,
      message: 'Password reset email sent! Check your email for instructions.'
    };

  } catch (error: any) {
    console.error('Unexpected error during password reset:', error);
    return {
      success: false,
      message: 'An unexpected error occurred. Please try again.',
      error: error.message
    };
  }
}

/**
 * Update user password (requires valid session)
 */
export async function updatePassword(newPassword: string): Promise<PasswordResetResult> {
  try {
    // Validate password strength
    if (newPassword.length < 6) {
      return {
        success: false,
        message: 'Password must be at least 6 characters long',
        error: 'Password too short'
      };
    }

    console.log('🔐 Updating user password...');
    
    // Update password
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword
    });

    console.log('🔐 Password update response:', { data, error });

    if (error) {
      console.error('❌ Password update error:', error);
      
      let userFriendlyMessage = 'Failed to update password. Please try again.';
      
      if (error.message.includes('Password should be at least')) {
        userFriendlyMessage = 'Password must be at least 6 characters long.';
      } else if (error.message.includes('Invalid session')) {
        userFriendlyMessage = 'Your session has expired. Please sign in again.';
      }
      
      return {
        success: false,
        message: userFriendlyMessage,
        error: error.message
      };
    }

    console.log('✅ Password updated successfully');
    return {
      success: true,
      message: 'Password updated successfully!'
    };

  } catch (error: any) {
    console.error('Unexpected error during password update:', error);
    return {
      success: false,
      message: 'An unexpected error occurred. Please try again.',
      error: error.message
    };
  }
}

/**
 * Check if user has a valid session for password update
 */
export async function checkPasswordUpdateSession(): Promise<PasswordResetResult> {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      return {
        success: false,
        message: 'Unable to verify session. Please try again.',
        error: error.message
      };
    }

    if (!session) {
      return {
        success: false,
        message: 'No valid session found. Please use the password reset link from your email.',
        error: 'No session'
      };
    }

    return {
      success: true,
      message: 'Session is valid for password update.'
    };

  } catch (error: any) {
    console.error('Error checking password update session:', error);
    return {
      success: false,
      message: 'An unexpected error occurred.',
      error: error.message
    };
  }
}
