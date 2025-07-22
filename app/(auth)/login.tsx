// app/(auth)/login.tsx
import { ThemedButton } from '@/components/themed/ThemedButton';
import { ThemedInput } from '@/components/themed/ThemedInput';
import { ThemedText } from '@/components/themed/ThemedText';
import { ThemedView } from '@/components/themed/ThemedView';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';

export default function LoginScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      Alert.alert('Login Error', error.message);
    } else {
      router.replace('/(tabs)/home');
    }
  };

  const handleBack = () => {
    console.log('🏠 LOGIN: Home button pressed, navigating to home');
    router.replace('/(tabs)/home');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Back Button */}
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#3b82f6" />
          <ThemedText style={styles.backText}>Home</ThemedText>
        </TouchableOpacity>

        <ThemedView style={styles.content}>
          {/* Logo/Icon */}
          <View
            style={[
              styles.logoContainer,
              { backgroundColor: theme.colors.primary },
            ]}
          >
            <Ionicons name="dice" size={60} color="#FFFFFF" />
          </View>

          {/* Welcome Text */}
          <ThemedText variant="title" style={styles.title}>
            Welcome Back
          </ThemedText>
          <ThemedText variant="body" style={styles.subtitle}>
            Sign in to track your dice stats
          </ThemedText>

          {/* Form */}
          <ThemedView variant="card" style={styles.formCard}>
            <ThemedInput
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              icon={
                <Ionicons
                  name="mail-outline"
                  size={20}
                  color={theme.colors.textSecondary}
                />
              }
            />

            <ThemedInput
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              icon={
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color={theme.colors.textSecondary}
                />
              }
              style={{ marginTop: theme.spacing.md }}
            />

            <ThemedButton
              title="Sign In"
              onPress={handleLogin}
              loading={loading}
              style={{ marginTop: theme.spacing.lg }}
            />
          </ThemedView>

          {/* Links */}
          <View style={styles.linksContainer}>
            <ThemedButton
              title="Create Account"
              variant="ghost"
              onPress={() => router.push('/(auth)/signUp')}
              size="small"
            />

            <ThemedButton
              title="Forgot Password?"
              variant="ghost"
              onPress={() =>
                Alert.alert(
                  'Reset Password',
                  'Password reset functionality coming soon!'
                )
              }
              size="small"
            />
          </View>
        </ThemedView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  backText: {
    marginLeft: 8,
    color: '#3b82f6',
    fontSize: 16,
    fontWeight: '500',
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 32,
  },
  title: {
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 32,
  },
  formCard: {
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
  },
  linksContainer: {
    marginTop: 24,
    alignItems: 'center',
    gap: 8,
  },
});
