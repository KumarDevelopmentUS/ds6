// app/_layout.tsx
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
import { Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

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
    const inTabsGroup = segments[0] === '(tabs)';

    // If the user is not signed in and is not in the auth group or tabs group,
    // redirect them to the sign-in page.
    if (!session && !inAuthGroup && !inTabsGroup) {
      console.log('🔒 ROUTE PROTECTION: Redirecting unauthenticated user to login from:', segments);
      router.replace('/(auth)/login');
    }

    // If the user is signed in and is in the auth group,
    // redirect them to the main app (home screen).
    else if (session && inAuthGroup) {
      console.log('🔒 ROUTE PROTECTION: Redirecting authenticated user to home');
      router.replace('/(tabs)/home');
    }
  }, [session, isReady, segments, router]);
}

function RootLayoutNav() {
  const { session, isReady } = useAuth();

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
          <QueryClientProvider client={queryClient}>
            <ThemeProvider>
              <HapticsProvider>
                <AuthProvider>
                  <FeedProvider>
                    <RootLayoutNav />
                  </FeedProvider>
                </AuthProvider>
              </HapticsProvider>
            </ThemeProvider>
          </QueryClientProvider>
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
