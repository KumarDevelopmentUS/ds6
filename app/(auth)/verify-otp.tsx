// app/(auth)/verify-otp.tsx
import { HapticBackButton } from '@/components/HapticBackButton';
import { ThemedButton } from '@/components/themed/ThemedButton';
import { ThemedText } from '@/components/themed/ThemedText';
import { ThemedView } from '@/components/themed/ThemedView';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/supabase';
import { ensureUserProfilesExist, joinDefaultCommunity } from '@/utils/profileSync';
import { retrievePendingSignupData } from '@/utils/signupStorage';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

export default function VerifyOTPScreen() {
  const { email, type } = useLocalSearchParams<{ email: string; type: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const styles = createStyles(theme);

  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputs = useRef<(TextInput | null)[]>([]);

  const handleDigitChange = (index: number, value: string) => {
    // Handle paste of full code
    if (value.length > 1) {
      const pasted = value.replace(/\D/g, '').slice(0, 6);
      const newDigits = [...digits];
      pasted.split('').forEach((d, i) => {
        if (index + i < 6) newDigits[index + i] = d;
      });
      setDigits(newDigits);
      const next = Math.min(index + pasted.length, 5);
      inputs.current[next]?.focus();
      return;
    }

    const digit = value.replace(/\D/g, '');
    const newDigits = [...digits];
    newDigits[index] = digit;
    setDigits(newDigits);
    if (digit && index < 5) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (index: number, key: string) => {
    if (key === 'Backspace' && !digits[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const token = digits.join('');
    if (token.length < 6) {
      setError('Please enter all 6 digits.');
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    });

    if (verifyError) {
      setError('Invalid or expired code. Please go back and request a new one.');
      setLoading(false);
      return;
    }

    if (data.session) {
      const user = data.session.user;

      if (type === 'signup') {
        const pendingData = retrievePendingSignupData(user.email || '');
        const userData = pendingData
          ? {
              username: pendingData.username,
              nickname: pendingData.nickname,
              firstName: pendingData.firstName,
              school: pendingData.school,
            }
          : {
              username: user.user_metadata?.username,
              nickname: user.user_metadata?.nickname,
              firstName: user.user_metadata?.nickname,
              school: user.user_metadata?.school,
            };

        try {
          await ensureUserProfilesExist(user.id, userData);
          await joinDefaultCommunity(user.id);
        } catch (e) {
          console.error('Profile setup error:', e);
        }
      }

      router.replace('/(tabs)/' as any);
    }

    setLoading(false);
  };

  // Auto-submit when all 6 digits are filled
  useEffect(() => {
    if (digits.every((d) => d !== '')) {
      handleVerify();
    }
  }, [digits]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <HapticBackButton
        onPress={() => router.back()}
        style={styles.backButton}
        color={theme.colors.primary}
      />

      <ThemedView style={styles.content}>
        <View style={[styles.iconContainer, { backgroundColor: theme.colors.primary }]}>
          <Ionicons name="mail" size={60} color="#FFFFFF" />
        </View>

        <ThemedText variant="title" style={styles.title}>
          Check Your Email
        </ThemedText>

        <ThemedText variant="body" style={styles.subtitle}>
          We sent a 6-digit code to{'\n'}
          <ThemedText variant="body" style={{ fontWeight: 'bold' }}>
            {email}
          </ThemedText>
        </ThemedText>

        <ThemedView variant="card" style={styles.card}>
          <View style={styles.codeRow}>
            {digits.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => { inputs.current[index] = ref; }}
                style={[
                  styles.digitBox,
                  {
                    borderColor: digit ? theme.colors.primary : theme.colors.border,
                    backgroundColor: theme.colors.inputBackground,
                    color: theme.colors.text,
                  },
                ]}
                value={digit}
                onChangeText={(val) => handleDigitChange(index, val)}
                onKeyPress={({ nativeEvent }) => handleKeyPress(index, nativeEvent.key)}
                keyboardType="number-pad"
                maxLength={6}
                selectTextOnFocus
                textAlign="center"
              />
            ))}
          </View>

          {error && (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={16} color={theme.colors.error} />
              <ThemedText variant="caption" style={[styles.errorText, { color: theme.colors.error }]}>
                {error}
              </ThemedText>
            </View>
          )}

          <ThemedButton
            title="Verify"
            onPress={handleVerify}
            loading={loading}
            disabled={digits.join('').length < 6}
            style={{ marginTop: theme.spacing.lg }}
          />
        </ThemedView>

        <ThemedText variant="caption" style={[styles.hint, { color: theme.colors.textSecondary }]}>
          Didn&apos;t receive it? Check your spam folder or go back to resend.
        </ThemedText>
      </ThemedView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    zIndex: 10,
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    padding: 24,
    borderRadius: 12,
  },
  codeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  digitBox: {
    width: 46,
    height: 56,
    borderRadius: 8,
    borderWidth: 2,
    fontSize: 24,
    fontWeight: 'bold',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  hint: {
    textAlign: 'center',
    marginTop: 24,
    lineHeight: 20,
  },
});
