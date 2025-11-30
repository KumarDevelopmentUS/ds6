// components/CommunityInvites.tsx
import { CommunityIcon } from '@/components/CommunityIcon';
import { ThemedButton } from '@/components/themed/ThemedButton';
import { ThemedText } from '@/components/themed/ThemedText';
import { ThemedView } from '@/components/themed/ThemedView';
import { useAuth } from '@/contexts/AuthContext';
import { useFeed } from '@/contexts/FeedContext';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/supabase';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';

type PendingInvite = {
  invite_id: number;
  community_id: number;
  community_name: string;
  community_icon: string | null;
  community_icon_color: string | null;
  community_background_color: string | null;
  inviter_id: string;
  inviter_name: string;
  created_at: string;
};

interface CommunityInvitesProps {
  onInviteResponded?: () => void;
}

export function CommunityInvites({ onInviteResponded }: CommunityInvitesProps) {
  const { theme } = useTheme();
  const { session } = useAuth();
  const { refetch: refetchCommunities } = useFeed();
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [respondingTo, setRespondingTo] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (session?.user) {
      loadInvites();
    }
  }, [session?.user]);

  const loadInvites = async () => {
    if (!session?.user?.id) return;
    setLoading(true);

    try {
      const { data, error } = await supabase.rpc('get_pending_invites');

      if (error) throw error;
      setInvites(data || []);
    } catch (error) {
      console.error('Error loading invites:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRespond = async (communityId: number, accept: boolean) => {
    setRespondingTo((prev) => new Set(prev).add(communityId));

    try {
      const { data, error } = await supabase.rpc('respond_to_invite', {
        p_community_id: communityId,
        p_accept: accept,
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string };
      if (!result.success) {
        throw new Error(result.error || 'Failed to respond to invite');
      }

      // Remove from local state
      setInvites((prev) => prev.filter((inv) => inv.community_id !== communityId));

      // Refresh communities if accepted
      if (accept) {
        refetchCommunities();
      }

      // Notify parent
      if (onInviteResponded) {
        onInviteResponded();
      }

      const message = accept ? 'You have joined the community!' : 'Invite declined.';
      if (Platform.OS === 'web') {
        alert(message);
      } else {
        Alert.alert('Success', message);
      }
    } catch (error: any) {
      console.error('Error responding to invite:', error);
      if (Platform.OS === 'web') {
        alert(`Error: ${error.message}`);
      } else {
        Alert.alert('Error', error.message || 'Failed to respond to invite');
      }
    } finally {
      setRespondingTo((prev) => {
        const newSet = new Set(prev);
        newSet.delete(communityId);
        return newSet;
      });
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={theme.colors.primary} />
      </View>
    );
  }

  if (invites.length === 0) {
    return null; // Don't show anything if no invites
  }

  return (
    <ThemedView variant="card" style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="mail" size={20} color={theme.colors.primary} />
        <ThemedText variant="subtitle" style={styles.headerText}>
          Community Invites ({invites.length})
        </ThemedText>
      </View>

      {invites.map((invite) => {
        const isResponding = respondingTo.has(invite.community_id);

        return (
          <View
            key={invite.invite_id}
            style={[styles.inviteItem, { borderColor: theme.colors.border }]}
          >
            <View style={styles.inviteContent}>
              <CommunityIcon
                icon={invite.community_icon}
                iconColor={invite.community_icon_color}
                backgroundColor={invite.community_background_color}
                size={48}
              />
              <View style={styles.inviteInfo}>
                <ThemedText variant="body" style={styles.communityName}>
                  {invite.community_name}
                </ThemedText>
                <ThemedText variant="caption" style={{ color: theme.colors.textSecondary }}>
                  Invited by {invite.inviter_name}
                </ThemedText>
                <ThemedText variant="caption" style={{ color: theme.colors.textSecondary, fontSize: 11 }}>
                  {formatDate(invite.created_at)}
                </ThemedText>
              </View>
            </View>

            <View style={styles.inviteActions}>
              <TouchableOpacity
                style={[styles.declineButton, { borderColor: theme.colors.border }]}
                onPress={() => handleRespond(invite.community_id, false)}
                disabled={isResponding}
              >
                {isResponding ? (
                  <ActivityIndicator size="small" color={theme.colors.textSecondary} />
                ) : (
                  <Ionicons name="close" size={20} color={theme.colors.textSecondary} />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.acceptButton, { backgroundColor: theme.colors.primary }]}
                onPress={() => handleRespond(invite.community_id, true)}
                disabled={isResponding}
              >
                {isResponding ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        );
      })}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  headerText: {
    fontWeight: '600',
  },
  inviteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  inviteContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  inviteInfo: {
    marginLeft: 12,
    flex: 1,
  },
  communityName: {
    fontWeight: '600',
    marginBottom: 2,
  },
  inviteActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  declineButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default CommunityInvites;

