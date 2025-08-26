// app/(tabs)/_layout.tsx
import { Stack } from 'expo-router';
import React from 'react';

// Simple stack layout - the custom tab logic is in index.tsx
export default function TabLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="index" />
    </Stack>
  );
}
