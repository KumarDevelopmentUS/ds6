import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/supabase';
import { testStorageSecurity } from '@/utils/storageSecurityTest';
import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export const DebugPanel = () => {
  const [debugInfo, setDebugInfo] = useState<any>({});
  const [isLoading, setIsLoading] = useState(false);
  const { session } = useAuth();

  const runDebug = async () => {
    setIsLoading(true);
    const info: any = {};

    try {
      // Step 1: Check environment variables
      info.step1 = {
        hasUrl: !!process.env.EXPO_PUBLIC_SUPABASE_URL,
        hasKey: !!process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
        urlLength: process.env.EXPO_PUBLIC_SUPABASE_URL?.length,
        keyLength: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.length
      };

      // Step 2: Check authentication
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      info.step2 = {
        hasUser: !!user,
        userId: user?.id,
        email: user?.email,
        authError: authError?.message
      };

      // Step 3: Test database connection
      const { data: connTest, error: connError } = await supabase
        .from('profiles')
        .select('count')
        .limit(1);
      
      info.step3 = {
        success: !connError,
        error: connError?.message,
        errorCode: connError?.code
      };

      // Step 4: Check communities table
      const { data: communities, error: commError } = await supabase
        .from('communities')
        .select('*')
        .order('name');
      
      info.step4 = {
        success: !commError,
        error: commError?.message,
        count: communities?.length || 0,
        communities: communities?.map((c: any) => ({ id: c.id, name: c.name, type: c.type }))
      };

      // Step 5: Check user communities
      if (user) {
        const { data: userCommunities, error: ucError } = await supabase
          .from('user_communities')
          .select('*, communities(*)')
          .eq('user_id', user.id);
        
        info.step5 = {
          success: !ucError,
          error: ucError?.message,
          errorCode: ucError?.code,
          count: userCommunities?.length || 0,
          rawData: userCommunities
        };
      }

      setDebugInfo(info);
      
      // Show summary alert
      const summary = `
🔍 DEBUG SUMMARY:
✅ Env vars: ${info.step1.hasUrl && info.step1.hasKey ? 'OK' : 'MISSING'}
✅ Auth: ${info.step2.hasUser ? 'OK' : 'FAILED'}
✅ DB Connection: ${info.step3.success ? 'OK' : 'FAILED'}
✅ Communities table: ${info.step4.success ? 'OK' : 'FAILED'}
✅ User communities: ${info.step5?.success ? 'OK' : 'FAILED'}

Found ${info.step4.count} communities
User has ${info.step5?.count || 0} memberships
      `.trim();

      Alert.alert('Debug Complete', summary);

    } catch (error) {
      console.error('Debug error:', error);
      Alert.alert('Debug Failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const fixCommunities = async () => {
    if (!session?.user) {
      Alert.alert('Not authenticated');
      return;
    }

    try {
      setIsLoading(true);
      
      // Get first available community
      const { data: communities } = await supabase
        .from('communities')
        .select('*')
        .limit(1);

      if (!communities || communities.length === 0) {
        Alert.alert('No communities exist');
        return;
      }

      // Add user to first community
      const { error } = await supabase
        .from('user_communities')
        .insert({
          user_id: session.user.id,
          community_id: communities[0].id
        });

      if (error) {
        if (error.code === '23505') {
          Alert.alert('Already a member', 'You are already a member of this community');
        } else {
          Alert.alert('Error', error.message);
        }
      } else {
        Alert.alert('Success', 'Added to community! Please refresh the app.');
      }

    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const refreshCache = async () => {
    try {
      setIsLoading(true);
      
      // Force refresh the page to clear all React Query cache
      if (typeof window !== 'undefined') {
        Alert.alert('Refreshing', 'Refreshing the app to clear cache...');
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        Alert.alert('Refresh', 'Please manually refresh the app to clear cache');
      }
      
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const runSecurityTest = async () => {
    try {
      setIsLoading(true);
      console.log('🔐 Starting comprehensive security test...');
      
      const securityResult = await testStorageSecurity();
      
      setDebugInfo({
        ...debugInfo,
        securityTest: securityResult
      });
      
      if (securityResult.success) {
        Alert.alert('Security Test Complete', 'Security test completed. Check console for detailed results.');
      } else {
        Alert.alert('Security Issues Found', `Found ${securityResult.errors.length} security issues. Check console for details.`);
      }
      
    } catch (error) {
      console.error('Security test failed:', error);
      Alert.alert('Security Test Failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>🔍 Debug Panel</Text>
      
      <TouchableOpacity 
        style={[styles.button, isLoading && styles.buttonDisabled]} 
        onPress={runDebug}
        disabled={isLoading}
      >
        <Text style={styles.buttonText}>
          {isLoading ? 'Running Debug...' : '🔍 Run Debug'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.button, styles.fixButton, isLoading && styles.buttonDisabled]} 
        onPress={fixCommunities}
        disabled={isLoading}
      >
        <Text style={styles.buttonText}>🔧 Fix Communities</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.button, styles.refreshButton, isLoading && styles.buttonDisabled]} 
        onPress={refreshCache}
        disabled={isLoading}
      >
        <Text style={styles.buttonText}>🔄 Refresh Cache</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.button, styles.securityButton, isLoading && styles.buttonDisabled]} 
        onPress={runSecurityTest}
        disabled={isLoading}
      >
        <Text style={styles.buttonText}>🔐 Security Test</Text>
      </TouchableOpacity>

      {Object.keys(debugInfo).length > 0 && (
        <View style={styles.debugInfo}>
          <Text style={styles.debugTitle}>Debug Results:</Text>
          <Text style={styles.debugText}>
            {JSON.stringify(debugInfo, null, 2)}
          </Text>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  fixButton: {
    backgroundColor: '#28a745',
  },
  refreshButton: {
    backgroundColor: '#ffc107',
  },
  securityButton: {
    backgroundColor: '#dc3545',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 16,
  },
  debugInfo: {
    marginTop: 20,
    padding: 15,
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  debugTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  debugText: {
    fontSize: 12,
    fontFamily: 'monospace',
  },
}); 