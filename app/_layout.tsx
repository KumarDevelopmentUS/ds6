// app/_layout.tsx
import { supabase } from '@/supabase';
import { Session } from '@supabase/supabase-js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SplashScreen, Stack, useRouter, useSegments } from 'expo-router';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { ThemeProvider } from '@/contexts/ThemeContext';
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

// Create an authentication context.
const AuthContext = createContext<{
  session: Session | null;
  isReady: boolean;
}>({
  session: null,
  isReady: false,
});

// Custom hook to use the AuthContext.
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

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

    // If the user is not signed in and is not in the auth group,
    // redirect them to the sign-in page.
    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
    }

    // If the user is signed in and is in the auth group,
    // redirect them to the main app (home screen).
    else if (session && inAuthGroup) {
      router.replace('/(tabs)/home');
    }
  }, [session, isReady, segments, router]);
}

function RootLayoutNav() {
  const [session, setSession] = useState<Session | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Fetch initial session.
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsReady(true);
    });

    // Listen for auth state changes.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
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
    <AuthContext.Provider value={{ session, isReady }}>
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
    </AuthContext.Provider>
  );
}

export default function RootLayout() {
  try {
    return (
      <ErrorBoundary>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <QueryClientProvider client={queryClient}>
            <ThemeProvider>
              <RootLayoutNav />
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
