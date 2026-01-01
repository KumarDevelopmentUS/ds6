// app/join-community.tsx
import { CommunityIcon } from '@/components/CommunityIcon';
import { HapticBackButton } from '@/components/HapticBackButton';
import { ThemedButton } from '@/components/themed/ThemedButton';
import { ThemedText } from '@/components/themed/ThemedText';
import { ThemedView } from '@/components/themed/ThemedView';
import { useAuth } from '@/contexts/AuthContext';
import { useFeed } from '@/contexts/FeedContext';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

export default function JoinCommunityScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { session } = useAuth();
  const { refetch: refetchCommunities } = useFeed();

  const [inviteCode, setInviteCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');

  const handleCodeChange = (text: string) => {
    // Only allow uppercase letters, max 6 characters (same as room codes)
    const cleaned = text.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6);
    setInviteCode(cleaned);
    setError('');
  };

  const handleJoin = async () => {
    if (!inviteCode.trim()) {
      setError('Please enter an invite code');
      return;
    }

    if (!session?.user?.id) {
      setError('You must be logged in to join a community');
      return;
    }

    setJoining(true);
    setError('');

    try {
      const { data, error: rpcError } = await supabase.rpc('join_community_by_code', {
        p_invite_code: inviteCode.trim(),
      });

      if (rpcError) throw rpcError;

      const result = data as { success: boolean; community_id?: number; community_name?: string; error?: string };

      if (!result.success) {
        setError(result.error || 'Failed to join community');
        return;
      }

      // Success!
      refetchCommunities();

      if (Platform.OS === 'web') {
        alert(`Welcome! You've joined "${result.community_name}"`);
      } else {
        Alert.alert('Success!', `Welcome! You've joined "${result.community_name}"`, [{ text: 'OK' }]);
      }

      router.back();
    } catch (err: any) {
      console.error('Error joining community:', err);
      setError(err.message || 'Failed to join community');
    } finally {
      setJoining(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <HapticBackButton onPress={() => router.back()} color={theme.colors.primary} />
          <ThemedText variant="title" style={styles.headerTitle}>
            Join Community
          </ThemedText>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.content}>
          {/* Icon */}
          <View style={[styles.iconContainer, { backgroundColor: theme.colors.primary + '15' }]}>
            <Ionicons name="enter-outline" size={64} color={theme.colors.primary} />
          </View>

          <ThemedText variant="subtitle" style={styles.title}>
            Enter Invite Code
          </ThemedText>
          <ThemedText variant="body" style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
            Ask a community owner for their invite code to join their private community
          </ThemedText>

          {/* Code Input */}
          <View style={[styles.codeInputContainer, { backgroundColor: theme.colors.inputBackground, borderColor: error ? theme.colors.error : theme.colors.border }]}>
            <TextInput
              style={[styles.codeInput, { color: theme.colors.text }]}
              value={inviteCode}
              onChangeText={handleCodeChange}
              placeholder="XXXXXX"
              placeholderTextColor={theme.colors.textSecondary}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={6}
              autoFocus
            />
          </View>

          {error ? (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={16} color={theme.colors.error} />
              <ThemedText variant="caption" style={[styles.errorText, { color: theme.colors.error }]}>
                {error}
              </ThemedText>
            </View>
          ) : (
            <ThemedText variant="caption" style={[styles.hintText, { color: theme.colors.textSecondary }]}>
              Invite codes are 6 capital letters
            </ThemedText>
          )}

          {/* Join Button */}
          <ThemedButton
            title={joining ? 'Joining...' : 'Join Community'}
            onPress={handleJoin}
            loading={joining}
            disabled={joining || inviteCode.length < 6}
            style={styles.joinButton}
          />
        </View>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingBottom: 16,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
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
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  codeInputContainer: {
    width: '100%',
    maxWidth: 300,
    borderRadius: 12,
    borderWidth: 2,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  codeInput: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 4,
    textAlign: 'center',
    paddingVertical: 16,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 6,
  },
  errorText: {
    fontWeight: '500',
  },
  hintText: {
    marginTop: 12,
  },
  joinButton: {
    marginTop: 32,
    width: '100%',
    maxWidth: 300,
  },
});

