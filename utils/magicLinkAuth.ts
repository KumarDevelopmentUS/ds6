// utils/magicLinkAuth.ts
import { supabase } from '@/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logError, logInfo, logSecurity } from './logger';

export interface MagicLinkResult {
  success: boolean;
  message: string;
  error?: string;
}

// Rate limiting configuration for magic links
const MAGIC_LINK_RATE_LIMIT_KEY = 'magic_link_rate_limit';
const MAGIC_LINK_RATE_LIMIT_WINDOW = 5 * 60 * 1000; // 5 minutes
const MAX_MAGIC_LINK_ATTEMPTS = 2; // Maximum 2 attempts per 5 minutes

interface MagicLinkRateLimitData {
  attempts: number;
  lastAttempt: number;
}

/**
 * Check if user has exceeded rate limit for magic link requests
 */
async function checkMagicLinkRateLimit(): Promise<{ allowed: boolean; remainingTime?: number }> {
  try {
    const stored = await AsyncStorage.getItem(MAGIC_LINK_RATE_LIMIT_KEY);
    const now = Date.now();
    
    if (!stored) {
      return { allowed: true };
    }
    
    const rateLimitData: MagicLinkRateLimitData = JSON.parse(stored);
    
    // If window has expired, reset
    if (now - rateLimitData.lastAttempt > MAGIC_LINK_RATE_LIMIT_WINDOW) {
      await AsyncStorage.removeItem(MAGIC_LINK_RATE_LIMIT_KEY);
      return { allowed: true };
    }
    
    // Check if max attempts reached
    if (rateLimitData.attempts >= MAX_MAGIC_LINK_ATTEMPTS) {
      const remainingTime = Math.ceil((MAGIC_LINK_RATE_LIMIT_WINDOW - (now - rateLimitData.lastAttempt)) / 60000);
      return { allowed: false, remainingTime };
    }
    
    return { allowed: true };
  } catch (error) {
    logError('Error checking magic link rate limit:', error);
    return { allowed: true }; // Allow on error to avoid blocking legitimate users
  }
}

/**
 * Record a magic link attempt
 */
async function recordMagicLinkAttempt(): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(MAGIC_LINK_RATE_LIMIT_KEY);
    const now = Date.now();
    
    let rateLimitData: MagicLinkRateLimitData;
    
    if (!stored) {
      rateLimitData = { attempts: 1, lastAttempt: now };
    } else {
      rateLimitData = JSON.parse(stored);
      
      // If window has expired, reset
      if (now - rateLimitData.lastAttempt > MAGIC_LINK_RATE_LIMIT_WINDOW) {
        rateLimitData = { attempts: 1, lastAttempt: now };
      } else {
        rateLimitData.attempts += 1;
        rateLimitData.lastAttempt = now;
      }
    }
    
    await AsyncStorage.setItem(MAGIC_LINK_RATE_LIMIT_KEY, JSON.stringify(rateLimitData));
  } catch (error) {
    logError('Error recording magic link rate limit attempt:', error);
  }
}

/**
 * Send magic link for sign up
 */
export async function sendMagicLinkSignup(email: string): Promise<MagicLinkResult> {
  try {
    // Check rate limit first
    const rateLimitCheck = await checkMagicLinkRateLimit();
    if (!rateLimitCheck.allowed) {
      return {
        success: false,
        message: `Too many magic link requests. Please wait ${rateLimitCheck.remainingTime} minutes before trying again.`,
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

    // Check if user already exists
    const { data: existingUser } = await supabase.auth.getUser();
    if (existingUser.user) {
      return {
        success: false,
        message: 'An account with this email already exists. Please sign in instead.',
        error: 'User already exists'
      };
    }

    // Send magic link for sign up
    logSecurity('Sending magic link signup');
    
    const { data, error } = await supabase.auth.signInWithOtp({
      email: email.toLowerCase(),
      options: {
        emailRedirectTo: 'https://diestats.app/auth/callback',
        shouldCreateUser: true, // This allows creating new users
      }
    });

    logSecurity('Magic link signup response received');

    if (error) {
      logError('Magic link signup error:', error.message);
      return {
        success: false,
        message: 'Failed to send magic link. Please try again.',
        error: error.message
      };
    }

    // Record attempt
    await recordMagicLinkAttempt();
    logSecurity('Magic link signup sent successfully');

    return {
      success: true,
      message: 'Magic link sent! Check your email to complete registration.'
    };

  } catch (error: any) {
    // Record attempt even on error
    await recordMagicLinkAttempt();
    logError('Unexpected error during magic link signup:', error);
    return {
      success: false,
      message: 'An unexpected error occurred. Please try again.',
      error: error.message
    };
  }
}

/**
 * Send magic link for sign in
 */
export async function sendMagicLinkSignin(email: string): Promise<MagicLinkResult> {
  try {
    // Check rate limit first
    const rateLimitCheck = await checkMagicLinkRateLimit();
    if (!rateLimitCheck.allowed) {
      return {
        success: false,
        message: `Too many magic link requests. Please wait ${rateLimitCheck.remainingTime} minutes before trying again.`,
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

    // Send magic link for sign in
    logSecurity('Sending magic link signin');
    
    const { data, error } = await supabase.auth.signInWithOtp({
      email: email.toLowerCase(),
      options: {
        emailRedirectTo: 'https://diestats.app/auth/callback',
        shouldCreateUser: false, // Only allow existing users
      }
    });

    logSecurity('Magic link signin response received');

    if (error) {
      // Record attempt even on error
      await recordMagicLinkAttempt();
      logError('Magic link signin error:', error.message);
      
      // Provide user-friendly error messages
      let userFriendlyMessage = 'Failed to send magic link. Please try again.';
      
      if (error.message.includes('User not found')) {
        userFriendlyMessage = 'No account found with this email. Please sign up first.';
      } else if (error.message.includes('Too many requests')) {
        userFriendlyMessage = 'Too many requests. Please wait a moment before trying again.';
      }
      
      return {
        success: false,
        message: userFriendlyMessage,
        error: error.message
      };
    }

    // Record successful attempt
    await recordMagicLinkAttempt();
    return {
      success: true,
      message: 'Magic link sent! Check your email to sign in.'
    };

  } catch (error: any) {
    // Record attempt even on error
    await recordMagicLinkAttempt();
    logError('Unexpected error during magic link signin:', error);
    return {
      success: false,
      message: 'An unexpected error occurred. Please try again.',
      error: error.message
    };
  }
}

/**
 * Handle magic link callback and redirect
 */
export async function handleMagicLinkCallback(): Promise<MagicLinkResult> {
  try {
    const { data, error } = await supabase.auth.getSession();
    
    if (error) {
      return {
        success: false,
        message: 'Authentication failed. Please try again.',
        error: error.message
      };
    }

    if (data.session) {
      return {
        success: true,
        message: 'Successfully authenticated!'
      };
    }

    return {
      success: false,
      message: 'No active session found.',
      error: 'No session'
    };

  } catch (error: any) {
    logError('Error handling magic link callback:', error);
    return {
      success: false,
      message: 'An unexpected error occurred during authentication.',
      error: error.message
    };
  }
}
