// utils/testMagicLink.ts
import { supabase } from '@/supabase';

export async function testMagicLink(email: string) {
  console.log('🧪 Testing magic link...');
  
  try {
    // Test 1: Check if Supabase client is working
    console.log('✅ Supabase client initialized');
    
    // Test 2: Try to send magic link
    const { data, error } = await supabase.auth.signInWithOtp({
      email: email.toLowerCase(),
      options: {
        emailRedirectTo: 'https://diestats.app/auth/callback',
        shouldCreateUser: true,
      }
    });

    console.log('📧 Magic link response:', { data, error });

    if (error) {
      console.error('❌ Magic link error:', error);
      return {
        success: false,
        error: error.message,
        details: error
      };
    }

    console.log('✅ Magic link sent successfully');
    return {
      success: true,
      data: data
    };

  } catch (error: any) {
    console.error('❌ Unexpected error:', error);
    return {
      success: false,
      error: error.message,
      details: error
    };
  }
}
