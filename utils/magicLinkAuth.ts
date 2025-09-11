// utils/magicLinkAuth.ts
import { supabase } from '@/supabase';

export interface MagicLinkResult {
  success: boolean;
  message: string;
  error?: string;
}

/**
 * Send magic link for sign up
 */
export async function sendMagicLinkSignup(email: string): Promise<MagicLinkResult> {
  try {
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
    console.log('📧 Sending magic link signup...');
    console.log('🔗 Redirect URL:', 'https://diestats.app/auth/callback');
    
    const { data, error } = await supabase.auth.signInWithOtp({
      email: email.toLowerCase(),
      options: {
        emailRedirectTo: 'https://diestats.app/auth/callback',
        shouldCreateUser: true, // This allows creating new users
      }
    });

    console.log('📧 Magic link response:', { data, error });

    if (error) {
      console.error('❌ Magic link signup error:', error);
      return {
        success: false,
        message: 'Failed to send magic link. Please try again.',
        error: error.message
      };
    }

    console.log('✅ Magic link signup sent successfully');

    return {
      success: true,
      message: 'Magic link sent! Check your email to complete registration.'
    };

  } catch (error: any) {
    console.error('Unexpected error during magic link signup:', error);
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
    console.log('📧 Sending magic link signin...');
    console.log('🔗 Redirect URL:', 'https://diestats.app/auth/callback');
    
    const { data, error } = await supabase.auth.signInWithOtp({
      email: email.toLowerCase(),
      options: {
        emailRedirectTo: 'https://diestats.app/auth/callback',
        shouldCreateUser: false, // Only allow existing users
      }
    });

    console.log('📧 Magic link response:', { data, error });

    if (error) {
      console.error('❌ Magic link signin error:', error);
      
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

    return {
      success: true,
      message: 'Magic link sent! Check your email to sign in.'
    };

  } catch (error: any) {
    console.error('Unexpected error during magic link signin:', error);
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
    console.error('Error handling magic link callback:', error);
    return {
      success: false,
      message: 'An unexpected error occurred during authentication.',
      error: error.message
    };
  }
}
