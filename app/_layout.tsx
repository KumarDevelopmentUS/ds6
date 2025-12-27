// app/_layout.tsx
import { ToastProvider } from '@/components/ui/Toast';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { FeedProvider } from '@/contexts/FeedContext';
import { HapticsProvider } from '@/contexts/HapticsContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { supabase } from '@/supabase';
import { ensureUserProfilesExist } from '@/utils/profileSync';
import type { Session } from '@supabase/supabase-js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SplashScreen, Stack, useRouter, useSegments } from 'expo-router';
import React, { useEffect } from 'react';
import { Platform, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Conditionally import Vercel Analytics only for web
const Analytics = Platform.OS === 'web' ? require('@vercel/analytics/react').Analytics : () => null;

// Keep the native splash screen visible while the app initializes.
SplashScreen.preventAutoHideAsync();

// Create a client for React Query.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
  },
});



// Error Boundary Component to catch rendering errors.
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    console.error('🔴 ErrorBoundary caught an error:', error);
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('🔴 ErrorBoundary componentDidCatch:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20,
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>
            Something went wrong!
          </Text>
          <Text style={{ textAlign: 'center', color: '#666' }}>
            {this.state.error?.toString()}
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

function useProtectedRoute(session: Session | null, isReady: boolean) {
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!isReady) {
      // Don't do anything until the auth state is confirmed.
      return;
    }

    const inAuthGroup = segments[0] === '(auth)';
    const isPasswordReset = segments[1] === 'new-password' || segments[1] === 'reset-password';

    // If the user is signed in and is in the auth group,
    // redirect them to the main app (home screen).
    // EXCEPTION: Allow password reset screens for authenticated users
    if (session && inAuthGroup && !isPasswordReset) {
      console.log('🔒 ROUTE PROTECTION: Redirecting authenticated user to home');
      router.replace('/(tabs)/' as any);
    }

    // Note: We no longer redirect unauthenticated users to login
    // They can freely access the home page and other public areas
    // Only specific features that require authentication will show login prompts
  }, [session, isReady, segments, router]);
}

function RootLayoutNav() {
  const { session, isReady } = useAuth();
  const segments = useSegments();

  // Track page navigation
  useEffect(() => {
    if (isReady) {
      // Format segments into readable page names
      const formatPageName = (segments: string[]): string => {
        if (segments.length === 0) return 'Root/Home';
        
        // Handle different route patterns
        const route = segments.join('/');
        
        // Map common routes to readable names
        const pageMap: { [key: string]: string } = {
          '(tabs)': 'Home (Tabs)',
          '(tabs)/_home': 'Home',
          '(tabs)/_feed': 'Feed',
          '(tabs)/_settings': 'Settings',
          '(auth)': 'Auth',
          '(auth)/login': 'Login',
          '(auth)/register': 'Register',
          'tracker': 'Game Tracker',
          'history': 'Match History',
          'stats': 'Player Statistics',
          'friends': 'Friends',
          'leaderboard': 'Leaderboard',
          'schlevins': 'Schlevins Game',
          'camera': 'Camera',
          'dual-camera': 'Dual Camera',
          'create-post': 'Create Post',
          'edit-profile': 'Edit Profile',
        };
        
        // Check for exact matches first
        if (pageMap[route]) {
          return pageMap[route];
        }
        
        // Handle dynamic routes (e.g., user-profile/[userId])
        if (route.includes('user-profile/')) {
          return `User Profile (${segments[segments.length - 1]})`;
        }
        
        if (route.includes('tracker/')) {
          return `Game Tracker (${segments[segments.length - 1]})`;
        }
        
        if (route.includes('community-members')) {
          return 'Community Members';
        }
        
        // Default: capitalize and clean up the route
        return route
          .split('/')
          .map(segment => 
            segment
              .replace(/[\(\)_]/g, '') // Remove parentheses and underscores
              .split('-')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ')
          )
          .filter(segment => segment.length > 0)
          .join(' > ');
      };
      
      const currentPage = formatPageName(segments);
      console.log('Current Page:', currentPage);
    }
  }, [segments, isReady]);

  useEffect(() => {
    // Listen for auth state changes for profile sync
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Ensure profiles exist when user signs in (but not on token refresh to avoid repeated calls)
      if (session?.user && event === 'SIGNED_IN') {
        console.log('🔄 User signed in, ensuring profiles exist...');
        try {
          // Run profile sync in background, don't await it to prevent blocking
          ensureUserProfilesExist(session.user.id, {
            username: session.user.user_metadata?.username,
            nickname: session.user.user_metadata?.nickname,
            school: session.user.user_metadata?.school,
          }).catch((error) => {
            console.error('❌ Profile sync failed:', error);
          });
        } catch (error) {
          console.error('❌ Profile sync error:', error);
        }
      }
    });

    // Unsubscribe from the listener when the component unmounts.
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Custom hook to handle navigation based on auth state.
  useProtectedRoute(session, isReady);

  useEffect(() => {
    // Hide the splash screen once the app is ready.
    if (isReady) {
      SplashScreen.hideAsync();
    }
  }, [isReady]);

  // Render nothing until the auth state is determined to prevent screen flickering.
  if (!isReady) {
    return null;
  }

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
      {/* Group screens */}
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="(auth)" />

      {/* Screens presented from the root */}
      <Stack.Screen name="tracker" />
      <Stack.Screen name="history" />
      <Stack.Screen name="stats" />
      <Stack.Screen name="friends" />
    </Stack>
  );
}

export default function RootLayout() {
  try {
    return (
      <ErrorBoundary>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            <ThemeProvider>
              <HapticsProvider>
                <AuthProvider>
                  <FeedProvider>
                      <ToastProvider>
                    <RootLayoutNav />
                    {Platform.OS === 'web' && <Analytics />}
                      </ToastProvider>
                  </FeedProvider>
                </AuthProvider>
              </HapticsProvider>
            </ThemeProvider>
          </QueryClientProvider>
          </SafeAreaProvider>
        </GestureHandlerRootView>
      </ErrorBoundary>
    );
  } catch (error) {
    // Fallback for critical errors during initial render.
    console.error('💥 Critical Error in RootLayout:', error);
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Critical Error: {error?.toString()}</Text>
      </View>
    );
  }
}
