// app/(auth)/new-password.tsx
import { HapticBackButton } from '@/components/HapticBackButton';
import { ThemedButton } from '@/components/themed/ThemedButton';
import { ThemedInput } from '@/components/themed/ThemedInput';
import { ThemedText } from '@/components/themed/ThemedText';
import { ThemedView } from '@/components/themed/ThemedView';
import { useTheme } from '@/contexts/ThemeContext';
import { checkPasswordUpdateSession, updatePassword } from '@/utils/passwordReset';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    View
} from 'react-native';

export default function NewPasswordScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionValid, setSessionValid] = useState<boolean | null>(null);
  const [passwordUpdated, setPasswordUpdated] = useState(false);

  // Check if session is valid for password update
  useEffect(() => {
    const checkSession = async () => {
      const result = await checkPasswordUpdateSession();
      setSessionValid(result.success);
      
      if (!result.success) {
        setError(result.message);
      }
    };
    
    checkSession();
  }, []);

  const handlePasswordUpdate = async () => {
    setError(null);
    
    if (!newPassword || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    
    try {
      const result = await updatePassword(newPassword);
      
      if (result.success) {
        setPasswordUpdated(true);
        
        // Show confirmation for 2 seconds, then redirect to home
        setTimeout(() => {
          router.replace('/(tabs)/' as any);
        }, 2000);
      } else {
        setError(result.message);
      }
    } catch (error: any) {
      setError('Failed to update password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    router.back();
  };

  const handleNewPasswordChange = (text: string) => {
    setNewPassword(text);
    if (error) setError(null);
  };

  const handleConfirmPasswordChange = (text: string) => {
    setConfirmPassword(text);
    if (error) setError(null);
  };

  if (sessionValid === null) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ThemedText>Checking session...</ThemedText>
      </ThemedView>
    );
  }

  if (sessionValid === false) {
    return (
      <ThemedView style={styles.errorContainer}>
        <View style={styles.errorContent}>
          <Ionicons name="alert-circle" size={60} color={theme.colors.error} />
          <ThemedText variant="title" style={[styles.errorTitle, { color: theme.colors.error }]}>
            Invalid Session
          </ThemedText>
          <ThemedText variant="body" style={styles.errorMessage}>
            {error || 'This password reset link is invalid or has expired. Please request a new password reset.'}
          </ThemedText>
          <ThemedButton
            title="Request New Reset"
            onPress={() => router.replace('/(auth)/reset-password')}
            style={{ marginTop: 20 }}
          />
        </View>
      </ThemedView>
    );
  }

  if (passwordUpdated) {
    return (
      <ThemedView style={styles.successContainer}>
        <View style={styles.successContent}>
          <Ionicons name="checkmark-circle" size={80} color={theme.colors.success} />
          <ThemedText variant="title" style={[styles.successTitle, { color: theme.colors.success }]}>
            Password Updated!
          </ThemedText>
          <ThemedText variant="body" style={styles.successMessage}>
            Your password has been updated successfully. Redirecting to home...
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

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
            <Ionicons name="key" size={60} color="#FFFFFF" />
          </View>

          {/* Header Text */}
          <ThemedText variant="title" style={styles.title}>
            Set New Password
          </ThemedText>
          <ThemedText variant="body" style={styles.subtitle}>
            Enter your new password below
          </ThemedText>

          {/* Form */}
          <ThemedView variant="card" style={styles.formCard}>
            <ThemedInput
              placeholder="New Password"
              value={newPassword}
              onChangeText={handleNewPasswordChange}
              secureTextEntry
              icon={
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color={theme.colors.textSecondary}
                />
              }
              style={{ marginBottom: error ? 5 : 0 }}
            />

            <ThemedInput
              placeholder="Confirm New Password"
              value={confirmPassword}
              onChangeText={handleConfirmPasswordChange}
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
              title="Update Password"
              onPress={handlePasswordUpdate}
              loading={loading}
              disabled={!newPassword.trim() || !confirmPassword.trim()}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  errorMessage: {
    textAlign: 'center',
    marginBottom: 20,
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  successTitle: {
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  successMessage: {
    textAlign: 'center',
    marginBottom: 20,
  },
});
