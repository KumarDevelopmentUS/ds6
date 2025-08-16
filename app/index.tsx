// app/index.tsx
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

export default function Index() {
  const router = useRouter();
  const { isReady } = useAuth();

  useEffect(() => {
    if (isReady) {
      // Always redirect to home page, regardless of authentication status
      // Unauthenticated users will see the guest interface on the home page
      router.replace('/(tabs)/home');
    }
  }, [isReady, router]);

  // Show loading indicator while determining auth state
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color="#007AFF" />
    </View>
  );
}
