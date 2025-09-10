// app/(auth)/login.tsx
import { HapticBackButton } from '@/components/HapticBackButton';
import { ThemedButton } from '@/components/themed/ThemedButton';
import { ThemedInput } from '@/components/themed/ThemedInput';
import { ThemedText } from '@/components/themed/ThemedText';
import { ThemedView } from '@/components/themed/ThemedView';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/supabase';
import { sendMagicLinkSignin } from '@/utils/magicLinkAuth';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    View
} from 'react-native';

export default function LoginScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [magicLinkLoading, setMagicLinkLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMagicLink, setShowMagicLink] = useState(false);

  const handleLogin = async () => {
    // Clear any previous errors
    setError(null);
    
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (authError) {
      // Provide user-friendly error messages
      let userFriendlyMessage = 'Login failed. Please try again.';
      
      if (authError.message.includes('Invalid login credentials')) {
        userFriendlyMessage = 'Invalid email or password. Please check your credentials and try again.';
      } else if (authError.message.includes('Email not confirmed')) {
        userFriendlyMessage = 'Please verify your email address before signing in.';
      } else if (authError.message.includes('Too many requests')) {
        userFriendlyMessage = 'Too many login attempts. Please wait a moment before trying again.';
      } else if (authError.message.includes('User not found')) {
        userFriendlyMessage = 'No account found with this email address.';
      }
      
      setError(userFriendlyMessage);
    } else {
      router.replace('/(tabs)/' as any);
    }
  };

  const handleBack = () => {
    console.log('🏠 LOGIN: Home button pressed, navigating to home');
    router.push('/(tabs)/' as any);
  };

  const handleEmailChange = (text: string) => {
    setEmail(text);
    if (error) setError(null);
  };

  const handlePasswordChange = (text: string) => {
    setPassword(text);
    if (error) setError(null);
  };

  const handleMagicLinkSignin = async () => {
    setError(null);
    
    if (!email) {
      setError('Please enter your email address');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setMagicLinkLoading(true);
    
    try {
      const result = await sendMagicLinkSignin(email);
      
      if (result.success) {
        Alert.alert(
          'Magic Link Sent!', 
          result.message,
          [{ text: 'OK', onPress: () => setShowMagicLink(false) }]
        );
      } else {
        setError(result.message);
      }
    } catch (error: any) {
      setError('Failed to send magic link. Please try again.');
    } finally {
      setMagicLinkLoading(false);
    }
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
        <HapticBackButton
          onPress={handleBack}
          style={styles.backButton}
          color="#3b82f6"
          text="Home"
        />

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
              onChangeText={handleEmailChange}
              keyboardType="email-address"
              autoCapitalize="none"
              icon={
                <Ionicons
                  name="mail-outline"
                  size={20}
                  color={theme.colors.textSecondary}
                />
              }
              style={{ marginBottom: error ? 5 : 0 }}
            />

            {!showMagicLink && (
              <ThemedInput
                placeholder="Password"
                value={password}
                onChangeText={handlePasswordChange}
                secureTextEntry
                icon={
                  <Ionicons
                    name="lock-closed-outline"
                    size={20}
                    color={theme.colors.textSecondary}
                  />
                }
                style={{ marginTop: theme.spacing.md, marginBottom: error ? 5 : 0 }}
              />
            )}

            {/* Error Display */}
            {error && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={16} color={theme.colors.error} />
                <ThemedText variant="caption" style={[styles.errorText, { color: theme.colors.error }]}>
                  {error}
                </ThemedText>
              </View>
            )}

            {showMagicLink ? (
              <ThemedButton
                title="Send Magic Link"
                onPress={handleMagicLinkSignin}
                loading={magicLinkLoading}
                disabled={!email.trim()}
                style={{ marginTop: theme.spacing.lg }}
              />
            ) : (
              <ThemedButton
                title="Sign In"
                onPress={handleLogin}
                loading={loading}
                disabled={!email.trim() || !password.trim()}
                style={{ marginTop: theme.spacing.lg }}
              />
            )}

            {/* Toggle between password and magic link */}
            <View style={[styles.authToggleContainer, { marginTop: theme.spacing.sm }]}>
              <ThemedButton
                title={showMagicLink ? "Use Password Instead" : "Use Magic Link Instead"}
                variant="ghost"
                onPress={() => {
                  setShowMagicLink(!showMagicLink);
                  setError(null);
                }}
                size="small"
              />
            </View>
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
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    paddingHorizontal: 4,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  authToggleContainer: {
    alignItems: 'center',
  },
});
