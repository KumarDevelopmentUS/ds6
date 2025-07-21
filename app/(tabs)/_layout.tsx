// app/(tabs)/_layout.tsx
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { FeedProvider } from '../../contexts/FeedContext';

// This file should only be responsible for setting up the tabs.
// The root _layout.tsx is responsible for protecting this route.

export default function TabLayout() {
  return (
    <FeedProvider>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: '#007AFF',
          // Note: I've removed the hardcoded white background to better support theming.
          // You can add it back if you prefer.
          // tabBarStyle: { backgroundColor: '#fff' },
          // headerStyle: { backgroundColor: '#fff' },
          headerTitleStyle: { fontWeight: '600' },
        }}
      >
        <Tabs.Screen
          name="home"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="home-outline" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="feed"
          options={{
            title: 'Feed',
            headerShown: false,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="people-outline" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="settings-outline" color={color} size={size} />
            ),
          }}
        />
      </Tabs>
    </FeedProvider>
  );
}
