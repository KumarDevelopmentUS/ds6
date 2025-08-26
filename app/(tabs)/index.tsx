// app/(tabs)/index.tsx
// This file exists to satisfy expo-router's requirement for an index route
// The actual tab logic is handled by CustomTabLayout
import { CustomTabLayout } from '@/components/CustomTabLayout';
import { useLocalSearchParams } from 'expo-router';
import React from 'react';

export default function TabsIndex() {
  const { initialTab } = useLocalSearchParams();
  
  return <CustomTabLayout initialTab={initialTab as string} />;
}
