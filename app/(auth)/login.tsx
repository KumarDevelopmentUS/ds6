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
import React, { useEffect, useState } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View
} from 'react-native';

export default function LoginScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailLinkLoading, setEmailLinkLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEmailLink, setShowEmailLink] = useState(true);
  const [emailLinkSent, setEmailLinkSent] = useState(false);
  const [cooldownTimer, setCooldownTimer] = useState(0);

  // Cooldown timer effect
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (cooldownTimer > 0) {
      interval = setInterval(() => {
        setCooldownTimer((prev) => {
          if (prev <= 1) {
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [cooldownTimer]);

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

  const handleEmailLinkSignin = async () => {
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

    // Check cooldown timer
    if (cooldownTimer > 0) {
      setError(`Please wait ${cooldownTimer} seconds before sending another email link`);
      return;
    }

    setEmailLinkLoading(true);
    
    try {
      const result = await sendMagicLinkSignin(email);
      
      if (result.success) {
        setEmailLinkSent(true);
        setError(null);
        setCooldownTimer(15); // Start 15-second cooldown
        // Don't show alert, let the UI show the success message
      } else {
        setError(result.message);
        setEmailLinkSent(false);
      }
    } catch (error: any) {
      setError('Failed to send email link. Please try again.');
    } finally {
      setEmailLinkLoading(false);
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

            {!showEmailLink && (
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

            {/* Success Display */}
            {emailLinkSent && (
              <View style={[styles.successContainer, { backgroundColor: theme.colors.success + '20', borderColor: theme.colors.success }]}>
                <Ionicons name="checkmark-circle" size={16} color={theme.colors.success} />
                <View style={styles.successTextContainer}>
                  <ThemedText variant="caption" style={[styles.successText, { color: theme.colors.success }]}>
                    Email link sent successfully!
                  </ThemedText>
                  <ThemedText variant="caption" style={[styles.successSubtext, { color: theme.colors.textSecondary }]}>
                    Check your email and click the link to sign in. <ThemedText variant="caption" style={[styles.successSubtext, { color: theme.colors.textSecondary, fontWeight: 'bold' }]}>It may take up to 60 seconds to receive the email.</ThemedText>
                  </ThemedText>
                </View>
              </View>
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

            {showEmailLink ? (
              <ThemedButton
                title={cooldownTimer > 0 ? `Resend in ${cooldownTimer}s` : "Send Email Link"}
                onPress={handleEmailLinkSignin}
                loading={emailLinkLoading}
                disabled={!email.trim() || cooldownTimer > 0}
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

            {/* Toggle between password and email link */}
            <View style={[styles.authToggleContainer, { marginTop: theme.spacing.sm }]}>
              <ThemedButton
                title={showEmailLink ? "Use Password Instead" : "Use Email Link Instead"}
                variant="ghost"
                onPress={() => {
                  setShowEmailLink(!showEmailLink);
                  setError(null);
                  setEmailLinkSent(false);
                  setCooldownTimer(0);
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

            <TouchableOpacity
              onPress={() => {
                console.log('🔗 Forgot Password button clicked, navigating to reset-password');
                try {
                  router.push('/reset-password' as any);
                } catch (error) {
                  console.error('❌ Navigation error:', error);
                }
              }}
              style={styles.forgotPasswordButton}
            >
              <ThemedText style={[styles.forgotPasswordText, { color: theme.colors.primary }]}>
                Forgot Password?
              </ThemedText>
            </TouchableOpacity>
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
  successContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  successTextContainer: {
    flex: 1,
  },
  successText: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  successSubtext: {
    fontSize: 11,
    fontWeight: '400',
    lineHeight: 16,
  },
  authToggleContainer: {
    alignItems: 'center',
  },
  forgotPasswordButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  forgotPasswordText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
