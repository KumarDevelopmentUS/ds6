// app/index.tsx
import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from './_layout';

export default function Index() {
  const router = useRouter();
  const { session, isReady } = useAuth();

  useEffect(() => {
    if (isReady) {
      // Navigate based on authentication status
      if (session) {
        router.replace('/(tabs)/home');
      } else {
        router.replace('/(auth)/login');
      }
    }
  }, [session, isReady, router]);

  // Show loading indicator while determining auth state
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color="#007AFF" />
    </View>
  );
}
