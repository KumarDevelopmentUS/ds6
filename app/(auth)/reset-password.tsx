// app/(auth)/reset-password.tsx
import { HapticBackButton } from '@/components/HapticBackButton';
import { ThemedButton } from '@/components/themed/ThemedButton';
import { ThemedInput } from '@/components/themed/ThemedInput';
import { ThemedText } from '@/components/themed/ThemedText';
import { ThemedView } from '@/components/themed/ThemedView';
import { useTheme } from '@/contexts/ThemeContext';
import { sendPasswordResetEmail } from '@/utils/passwordReset';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View
} from 'react-native';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  
  console.log('📧 ResetPasswordScreen loaded');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);
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

  const handlePasswordReset = async () => {
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
      setError(`Please wait ${cooldownTimer} seconds before sending another reset email`);
      return;
    }

    setLoading(true);
    
    try {
      const result = await sendPasswordResetEmail(email);
      
      if (result.success) {
        setEmailSent(true);
        setError(null);
        setCooldownTimer(30); // 30-second cooldown for password reset
      } else {
        setError(result.message);
        setEmailSent(false);
      }
    } catch (error: any) {
      setError('Failed to send password reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    router.back();
  };

  const handleEmailChange = (text: string) => {
    setEmail(text);
    if (error) setError(null);
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
          text="Back"
        />

        <ThemedView style={styles.content}>
          {/* Logo/Icon */}
          <View
            style={[
              styles.logoContainer,
              { backgroundColor: theme.colors.primary },
            ]}
          >
            <Ionicons name="lock-closed" size={60} color="#FFFFFF" />
          </View>

          {/* Header Text */}
          <ThemedText variant="title" style={styles.title}>
            Reset Password
          </ThemedText>
          <ThemedText variant="body" style={styles.subtitle}>
            Enter your email address and we&apos;ll send you a link to reset your password
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

            {/* Success Display */}
            {emailSent && (
              <View style={[styles.successContainer, { backgroundColor: theme.colors.success + '20', borderColor: theme.colors.success }]}>
                <Ionicons name="checkmark-circle" size={16} color={theme.colors.success} />
                <View style={styles.successTextContainer}>
                  <ThemedText variant="caption" style={[styles.successText, { color: theme.colors.success }]}>
                    Password reset email sent!
                  </ThemedText>
                  <ThemedText variant="caption" style={[styles.successSubtext, { color: theme.colors.textSecondary }]}>
                    Check your email and click the link to reset your password. <ThemedText variant="caption" style={[styles.successSubtext, { color: theme.colors.textSecondary, fontWeight: 'bold' }]}>It may take up to a minute to receive the email.</ThemedText>
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

            <ThemedButton
              title={cooldownTimer > 0 ? `Resend in ${cooldownTimer}s` : "Send Reset Email"}
              onPress={handlePasswordReset}
              loading={loading}
              disabled={!email.trim() || cooldownTimer > 0}
              style={{ marginTop: theme.spacing.lg }}
            />
          </ThemedView>

          {/* Links */}
          <View style={styles.linksContainer}>
            <ThemedButton
              title="Back to Sign In"
              variant="ghost"
              onPress={() => router.push('/(auth)/login')}
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
});
