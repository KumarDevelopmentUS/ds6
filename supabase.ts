import 'react-native-url-polyfill/auto';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

// --- Storage adapter that works on both web and native ---
const createStorageAdapter = () => {
  // On web, use a dummy storage during server-side rendering
  if (Platform.OS === 'web' && typeof window === 'undefined') {
    return {
      getItem: async () => null,
      setItem: async () => {},
      removeItem: async () => {},
    };
  }

  // On client-side web, use AsyncStorage
  if (Platform.OS === 'web') {
    return AsyncStorage;
  }

  // On native platforms (iOS/Android), use SecureStore
  return {
    getItem: (key: string) => {
      return SecureStore.getItemAsync(key);
    },
    setItem: (key: string, value: string) => {
      console.log(`Attempting to set SecureStore key: ${key}`);
      console.log(`Value length for ${key}: ${value.length} characters`);
      return SecureStore.setItemAsync(key, value);
    },
    removeItem: (key: string) => {
      return SecureStore.deleteItemAsync(key);
    },
  };
};

// --- Supabase Client Initialization ---
// IMPORTANT: Replace with your actual Supabase project URL and Anon Key
// stored in your environment variables.
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL or Anon Key is missing from environment variables.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: createStorageAdapter(), // Use our custom platform-specific storage adapter
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});