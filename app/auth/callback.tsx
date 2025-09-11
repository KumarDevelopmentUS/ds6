// app/auth/callback.tsx
import { ThemedText } from '@/components/themed/ThemedText';
import { ThemedView } from '@/components/themed/ThemedView';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

export default function AuthCallbackScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Processing authentication...');

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        console.log('🔄 Processing auth callback...');
        
        // First, try to get the session from the URL hash/fragment
        const { data: { session }, error } = await supabase.auth.getSession();
        
        console.log('📋 Session check completed');
        
        if (error) {
          console.error('❌ Auth callback error:', error);
          setStatus('error');
          setMessage('Authentication failed. Please try again.');
          return;
        }

        if (session) {
          console.log('✅ Session found, user authenticated');
          setStatus('success');
          setMessage('Successfully authenticated! Redirecting...');
          
          // Redirect to home after a short delay
          setTimeout(() => {
            router.replace('/(tabs)/' as any);
          }, 2000);
        } else {
          console.log('⚠️ No session found, trying to handle URL parameters...');
          
          // If no session, try to handle the auth code from URL parameters
          const urlParams = new URLSearchParams(window.location.search);
          const code = urlParams.get('code');
          
          if (code) {
            console.log('🔑 Found auth code in URL, attempting to exchange...');
            
            // Exchange the code for a session
            const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
            
            if (exchangeError) {
              console.error('❌ Code exchange error:', exchangeError);
              setStatus('error');
              setMessage('Authentication failed. Please try again.');
              return;
            }
            
            if (data.session) {
              console.log('✅ Code exchanged successfully, user authenticated');
              setStatus('success');
              setMessage('Successfully authenticated! Redirecting...');
              
              // Redirect to home after a short delay
              setTimeout(() => {
                router.replace('/(tabs)/' as any);
              }, 2000);
            } else {
              console.log('❌ No session after code exchange');
              setStatus('error');
              setMessage('Authentication failed. Please try again.');
            }
          } else {
            console.log('❌ No auth code found in URL');
            setStatus('error');
            setMessage('No session found. Please try signing in again.');
          }
        }
      } catch (error: any) {
        console.error('❌ Unexpected error in auth callback:', error);
        setStatus('error');
        setMessage('An unexpected error occurred. Please try again.');
      }
    };

    handleAuthCallback();
  }, [router]);

  const getStatusIcon = () => {
    switch (status) {
      case 'loading':
        return <ActivityIndicator size="large" color={theme.colors.primary} />;
      case 'success':
        return <Ionicons name="checkmark-circle" size={60} color={theme.colors.success} />;
      case 'error':
        return <Ionicons name="close-circle" size={60} color={theme.colors.error} />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'loading':
        return theme.colors.primary;
      case 'success':
        return theme.colors.success;
      case 'error':
        return theme.colors.error;
    }
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.content}>
        <View style={[styles.iconContainer, { backgroundColor: getStatusColor() + '20' }]}>
          {getStatusIcon()}
        </View>
        
        <ThemedText variant="title" style={[styles.title, { color: getStatusColor() }]}>
          {status === 'loading' && 'Authenticating...'}
          {status === 'success' && 'Welcome Back!'}
          {status === 'error' && 'Authentication Failed'}
        </ThemedText>
        
        <ThemedText variant="body" style={styles.message}>
          {message}
        </ThemedText>

        {status === 'error' && (
          <View style={styles.errorActions}>
            <ThemedText 
              variant="caption" 
              style={[styles.retryText, { color: theme.colors.textSecondary }]}
            >
              You can try signing in again or contact support if the problem persists.
            </ThemedText>
          </View>
        )}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    alignItems: 'center',
    maxWidth: 400,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    textAlign: 'center',
    marginBottom: 16,
  },
  message: {
    textAlign: 'center',
    marginBottom: 24,
  },
  errorActions: {
    alignItems: 'center',
  },
  retryText: {
    textAlign: 'center',
    lineHeight: 20,
  },
});
