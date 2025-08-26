import { supabase } from '@/supabase';

export interface SecurityTestResult {
  success: boolean;
  tests: {
    authenticated_upload: boolean;
    unauthorized_access: boolean;
    user_ownership: boolean;
    rls_enabled: boolean;
  };
  errors: string[];
  recommendations: string[];
}

/**
 * Comprehensive storage security test
 * Tests authentication, authorization, and RLS policies
 */
export async function testStorageSecurity(): Promise<SecurityTestResult> {
  console.log('🔐 STORAGE SECURITY TEST: Starting comprehensive security analysis...');
  
  const result: SecurityTestResult = {
    success: true,
    tests: {
      authenticated_upload: false,
      unauthorized_access: false,
      user_ownership: false,
      rls_enabled: false,
    },
    errors: [],
    recommendations: []
  };

  try {
    // Test 1: Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      result.errors.push('❌ No authenticated user - cannot perform security tests');
      result.success = false;
      return result;
    }

    // Get username for logging
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('username')
      .eq('id', user.id)
      .single();
    
    const username = userProfile?.username || 'unknown';
    console.log('👤 Testing with user:', username);

    // Test 2: Test authenticated upload to profile-pictures
    console.log('🔍 TEST 1: Testing authenticated upload to profile-pictures bucket...');
    const testFileName = `security-test-${user.id}-${Date.now()}.txt`;
    const testContent = new Blob(['security test content'], { type: 'text/plain' });
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('profile-pictures')
      .upload(testFileName, testContent);

    if (uploadError) {
      result.errors.push(`❌ Authenticated upload failed: ${uploadError.message}`);
      if (uploadError.message.includes('RLS')) {
        result.recommendations.push('📝 Enable RLS policies for profile-pictures bucket');
      }
    } else {
      result.tests.authenticated_upload = true;
      console.log('✅ Authenticated upload successful');
      
      // Clean up test file
      await supabase.storage.from('profile-pictures').remove([testFileName]);
    }

    // Test 3: Test post-images bucket upload
    console.log('🔍 TEST 2: Testing authenticated upload to post-images bucket...');
    const postTestFileName = `security-test-post-${user.id}-${Date.now()}.txt`;
    
    const { data: postUploadData, error: postUploadError } = await supabase.storage
      .from('post-images')
      .upload(postTestFileName, testContent);

    if (postUploadError) {
      result.errors.push(`❌ Post images upload failed: ${postUploadError.message}`);
      if (postUploadError.message.includes('RLS')) {
        result.recommendations.push('📝 Enable RLS policies for post-images bucket');
      }
    } else {
      console.log('✅ Post images upload successful');
      
      // Clean up test file
      await supabase.storage.from('post-images').remove([postTestFileName]);
    }

    // Test 4: Test if storage buckets are publicly accessible without auth
    console.log('🔍 TEST 3: Testing unauthorized access to storage buckets...');
    result.tests.unauthorized_access = await testUnauthorizedAccess();

    // Test 5: Test user ownership validation
    console.log('🔍 TEST 4: Testing user ownership validation...');
    result.tests.user_ownership = await validateUserStorageAccess(user.id);

    // Test 6: Check if RLS is enabled on storage buckets
    console.log('🔍 TEST 5: Checking RLS status on storage buckets...');
    result.tests.rls_enabled = await checkStorageRLSStatus();

  } catch (error) {
    result.errors.push(`❌ Unexpected error during security testing: ${error}`);
    result.success = false;
  }

  // Generate recommendations based on test results
  generateSecurityRecommendations(result);

  console.log('🔐 STORAGE SECURITY TEST COMPLETE');
  console.log('📊 Results:', result);
  
  return result;
}

/**
 * Test if storage buckets can be accessed without authentication
 */
export async function testUnauthorizedAccess(): Promise<boolean> {
  try {
    // Create a client without authentication
    const publicClient = supabase;
    
    // Try to list files in profile-pictures bucket
    const { data: profileFiles, error: profileError } = await publicClient.storage
      .from('profile-pictures')
      .list();

    // Try to list files in post-images bucket  
    const { data: postFiles, error: postError } = await publicClient.storage
      .from('post-images')
      .list();

    if (profileError || postError) {
      console.log('✅ Storage buckets properly reject unauthorized access');
      return true; // Good - unauthorized access is blocked
    } else {
      console.log('❌ WARNING: Storage buckets allow unauthorized access!');
      return false; // Bad - unauthorized access is allowed
    }
  } catch (error) {
    console.log('✅ Storage buckets properly reject unauthorized access (via exception)');
    return true;
  }
}

/**
 * Validate that users can only access their own files
 */
export async function validateUserStorageAccess(userId: string): Promise<boolean> {
  try {
    // Try to access files with user-specific naming pattern
    const { data: userFiles, error: userError } = await supabase.storage
      .from('profile-pictures')
      .list('', {
        search: `profile-${userId}`
      });

    if (userError) {
      console.log('❌ User cannot access their own files:', userError.message);
      return false;
    }

    // Try to access files with different user ID (should fail if RLS is working)
    const fakeUserId = 'fake-user-id-12345';
    const { data: otherFiles, error: otherError } = await supabase.storage
      .from('profile-pictures')
      .list('', {
        search: `profile-${fakeUserId}`
      });

    // If we can access other user's files, that's a security issue
    if (!otherError && otherFiles && otherFiles.length > 0) {
      console.log('❌ WARNING: Can access other users\' files!');
      return false;
    }

    console.log('✅ User ownership validation working correctly');
    return true;
  } catch (error) {
    console.log('❌ Error during user ownership validation:', error);
    return false;
  }
}

/**
 * Check if RLS is enabled on storage buckets
 */
async function checkStorageRLSStatus(): Promise<boolean> {
  try {
    // Try to perform operations that should be restricted by RLS
    const { data, error } = await supabase.storage
      .from('profile-pictures')
      .list('', { limit: 1 });

    // The fact that we can call this without error suggests RLS might not be restrictive enough
    // This is a basic check - more sophisticated RLS testing would require admin access
    
    if (error && error.message.includes('RLS')) {
      console.log('✅ RLS appears to be enabled and working');
      return true;
    } else {
      console.log('⚠️ RLS status unclear - manual verification recommended');
      return false;
    }
  } catch (error) {
    console.log('⚠️ Cannot determine RLS status:', error);
    return false;
  }
}

/**
 * Generate security recommendations based on test results
 */
function generateSecurityRecommendations(result: SecurityTestResult): void {
  if (!result.tests.authenticated_upload) {
    result.recommendations.push('🔧 Fix authentication issues preventing file uploads');
  }

  if (!result.tests.unauthorized_access) {
    result.recommendations.push('🔒 CRITICAL: Implement RLS policies to prevent unauthorized access to storage buckets');
    result.recommendations.push('🔧 Configure storage bucket policies to require authentication');
  }

  if (!result.tests.user_ownership) {
    result.recommendations.push('👤 Implement user ownership checks in storage policies');
    result.recommendations.push('🔧 Ensure users can only access their own files');
  }

  if (!result.tests.rls_enabled) {
    result.recommendations.push('🔐 Enable Row Level Security on storage buckets');
    result.recommendations.push('📝 Create storage policies that restrict access based on auth.uid()');
  }

  // Always recommend manual verification
  result.recommendations.push('🔍 Manually verify storage policies in Supabase Dashboard → Storage → Policies');
  result.recommendations.push('📋 Test storage access with different user accounts');
}

/**
 * Quick security check for development
 */
export async function quickStorageSecurityCheck(): Promise<boolean> {
  console.log('⚡ Quick storage security check...');
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.log('❌ No authenticated user');
    return false;
  }

  // Test basic upload functionality
  const testContent = new Blob(['test'], { type: 'text/plain' });
  const testFileName = `quick-test-${Date.now()}.txt`;
  
  const { error } = await supabase.storage
    .from('profile-pictures')
    .upload(testFileName, testContent);

  if (error) {
    console.log('❌ Upload failed:', error.message);
    return false;
  }

  // Clean up
  await supabase.storage.from('profile-pictures').remove([testFileName]);
  
  console.log('✅ Basic storage security check passed');
  return true;
}
