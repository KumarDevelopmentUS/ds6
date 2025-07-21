// app/tracker/_layout.tsx
import { Stack } from 'expo-router';
import React from 'react';

export default function TrackerLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="[roomCode]"
        options={{
          headerShown: true,
          headerTitle: 'Match Tracker',
        }}
      />
      <Stack.Screen
        name="join"
        options={{
          headerShown: true,
          headerTitle: 'Join Match',
          presentation: 'modal',
        }}
      />
    </Stack>
  );
}
