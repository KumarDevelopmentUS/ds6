// app/manage-community.tsx
import { CommunityIcon } from '@/components/CommunityIcon';
import { HapticBackButton } from '@/components/HapticBackButton';
import { UserAvatar } from '@/components/social/UserAvatar';
import { ThemedButton } from '@/components/themed/ThemedButton';
import { ThemedInput } from '@/components/themed/ThemedInput';
import { ThemedText } from '@/components/themed/ThemedText';
import { ThemedView } from '@/components/themed/ThemedView';
import { AVATAR_COLORS } from '@/constants/avatarIcons';
import { useAuth } from '@/contexts/AuthContext';
import { useFeed } from '@/contexts/FeedContext';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    FlatList,
    Modal,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Switch,
    TouchableOpacity,
    View,
} from 'react-native';

const { width } = Dimensions.get('window');
const COLOR_SWATCH_SIZE = 40;

type Member = {
  user_id: string;
  username: string;
  nickname: string;
  avatar_icon: string;
  avatar_icon_color: string;
  avatar_background_color: string;
  role: string;
  joined_at: string;
};

type UserProfile = {
  id: string;
  username: string;
  nickname: string;
  avatar_icon: string;
  avatar_icon_color: string;
  avatar_background_color: string;
};

type Community = {
  id: number;
  name: string;
  description: string | null;
  icon: string;
  icon_color: string;
  background_color: string;
  invite_code: string | null;
  invite_code_enabled: boolean;
  is_private: boolean;
  creator_id: string;
};

// Community icons (same as create-community)
const COMMUNITY_ICONS = [
  { name: 'people', label: 'People' },
  { name: 'home', label: 'Home' },
  { name: 'beer', label: 'Beer' },
  { name: 'game-controller', label: 'Game Controller' },
  { name: 'trophy', label: 'Trophy' },
  { name: 'star', label: 'Star' },
  { name: 'heart', label: 'Heart' },
  { name: 'flame', label: 'Flame' },
  { name: 'flash', label: 'Flash' },
  { name: 'rocket', label: 'Rocket' },
  { name: 'football', label: 'Football' },
  { name: 'basketball', label: 'Basketball' },
  { name: 'baseball', label: 'Baseball' },
  { name: 'dice', label: 'Dice' },
  { name: 'sparkles', label: 'Sparkles' },
  { name: 'skull', label: 'Skull' },
  { name: 'happy', label: 'Happy' },
  { name: 'planet', label: 'Planet' },
  { name: 'diamond', label: 'Diamond' },
  { name: 'shield', label: 'Shield' },
] as const;

export default function ManageCommunityScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { session } = useAuth();
  const { communityId } = useLocalSearchParams<{ communityId: string }>();
  const { refetch: refetchCommunities } = useFeed();

  const [community, setCommunity] = useState<Community | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [userRole, setUserRole] = useState<string>('member');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Edit state
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState('');
  const [editIcon, setEditIcon] = useState('people');
  const [editIconColor, setEditIconColor] = useState('#FFFFFF');
  const [editBgColor, setEditBgColor] = useState('#007AFF');
  const [saving, setSaving] = useState(false);

  // Modals
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [showIconColorPicker, setShowIconColorPicker] = useState(false);
  const [showBgColorPicker, setShowBgColorPicker] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);

  // Invite friends
  const [friends, setFriends] = useState<UserProfile[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [invitingFriends, setInvitingFriends] = useState<Set<string>>(new Set());
  const [togglingInviteCode, setTogglingInviteCode] = useState(false);

  useEffect(() => {
    if (communityId) {
      loadCommunityData();
    }
  }, [communityId]);

  const loadCommunityData = async () => {
    if (!communityId || !session?.user?.id) return;
    setLoading(true);

    try {
      // Load community details
      const { data: communityData, error: communityError } = await supabase
        .from('communities')
        .select('*')
        .eq('id', parseInt(communityId))
        .single();

      if (communityError) {
        console.error('Error loading community:', communityError);
        throw communityError;
      }
      setCommunity(communityData);

      // Set edit values
      setEditName(communityData.name);
      setEditIcon(communityData.icon || 'people');
      setEditIconColor(communityData.icon_color || '#FFFFFF');
      setEditBgColor(communityData.background_color || '#007AFF');

      // Get user's role - don't fail if this errors
      const { data: membership, error: membershipError } = await supabase
        .from('user_communities')
        .select('role')
        .eq('community_id', parseInt(communityId))
        .eq('user_id', session.user.id)
        .single();

      if (membershipError) {
        console.error('Error loading membership:', membershipError);
        setUserRole('member'); // Default to member
      } else {
        setUserRole(membership.role || 'member');
      }

      // Load members - try RPC first, fallback to direct query
      try {
        const { data: membersData, error: membersError } = await supabase.rpc(
          'get_community_members',
          { p_community_id: parseInt(communityId) }
        );

        if (membersError) {
          console.error('RPC get_community_members failed:', membersError);
          // Fallback to direct query
          await loadMembersFallback(parseInt(communityId));
        } else {
          console.log('Members loaded via RPC:', membersData?.length || 0);
          setMembers(membersData || []);
        }
      } catch (rpcError) {
        console.error('RPC error:', rpcError);
        await loadMembersFallback(parseInt(communityId));
      }
    } catch (error) {
      console.error('Error loading community:', error);
      if (Platform.OS === 'web') {
        alert('Failed to load community data');
      } else {
        Alert.alert('Error', 'Failed to load community data');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadMembersFallback = async (commId: number) => {
    try {
      console.log('Loading members via fallback query for community:', commId);
      const { data: fallbackMembers, error } = await supabase
        .from('user_communities')
        .select('user_id, role, joined_at')
        .eq('community_id', commId);

      if (error) {
        console.error('Fallback members query failed:', error);
        setMembers([]);
        return;
      }

      console.log('Fallback found memberships:', fallbackMembers?.length || 0);

      if (!fallbackMembers || fallbackMembers.length === 0) {
        setMembers([]);
        return;
      }

      // Get user profiles for these members
      const userIds = fallbackMembers.map(m => m.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select('id, username, nickname, avatar_icon, avatar_icon_color, avatar_background_color')
        .in('id', userIds);

      if (profilesError) {
        console.error('Error loading profiles:', profilesError);
      }

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      const membersList = fallbackMembers.map((m: any) => {
        const profile = profileMap.get(m.user_id);
        return {
          user_id: m.user_id,
          username: profile?.username || 'Unknown',
          nickname: profile?.nickname || profile?.username || 'Unknown',
          avatar_icon: profile?.avatar_icon || 'person',
          avatar_icon_color: profile?.avatar_icon_color || '#FFFFFF',
          avatar_background_color: profile?.avatar_background_color || '#007AFF',
          role: m.role || 'member',
          joined_at: m.joined_at,
        };
      });

      console.log('Members loaded via fallback:', membersList.length);
      setMembers(membersList);
    } catch (err) {
      console.error('Fallback loading failed:', err);
      setMembers([]);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadCommunityData();
    setRefreshing(false);
  };

  const loadFriends = async () => {
    if (!session?.user?.id) return;
    setLoadingFriends(true);

    try {
      // Get accepted friendships
      const { data: friendships, error } = await supabase
        .from('friends')
        .select('user_id_1, user_id_2')
        .or(`user_id_1.eq.${session.user.id},user_id_2.eq.${session.user.id}`)
        .eq('status', 'accepted');

      if (error) throw error;

      // Extract friend IDs
      const friendIds = friendships.map((f) =>
        f.user_id_1 === session.user.id ? f.user_id_2 : f.user_id_1
      );

      // Filter out users who are already members
      const memberIds = new Set(members.map((m) => m.user_id));
      const nonMemberFriendIds = friendIds.filter((id) => !memberIds.has(id));

      if (nonMemberFriendIds.length === 0) {
        setFriends([]);
        setLoadingFriends(false);
        return;
      }

      // Get friend profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select('id, username, nickname, avatar_icon, avatar_icon_color, avatar_background_color')
        .in('id', nonMemberFriendIds);

      if (profilesError) throw profilesError;

      setFriends(
        profiles.map((p) => ({
          id: p.id,
          username: p.username || 'Unknown',
          nickname: p.nickname || p.username || 'Unknown',
          avatar_icon: p.avatar_icon || 'person',
          avatar_icon_color: p.avatar_icon_color || '#FFFFFF',
          avatar_background_color: p.avatar_background_color || theme.colors.primary,
        }))
      );
    } catch (error) {
      console.error('Error loading friends:', error);
    } finally {
      setLoadingFriends(false);
    }
  };

  const handleSaveChanges = async () => {
    if (!community || !editName.trim()) return;
    setSaving(true);

    try {
      const { data, error } = await supabase.rpc('update_community', {
        p_community_id: community.id,
        p_name: editName.trim(),
        p_icon: editIcon,
        p_icon_color: editIconColor,
        p_background_color: editBgColor,
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string };
      if (!result.success) {
        throw new Error(result.error || 'Failed to update community');
      }

      // Update local state
      setCommunity({
        ...community,
        name: editName.trim(),
        icon: editIcon,
        icon_color: editIconColor,
        background_color: editBgColor,
      });

      setEditMode(false);
      refetchCommunities();

      if (Platform.OS === 'web') {
        alert('Community updated successfully!');
      } else {
        Alert.alert('Success', 'Community updated successfully!');
      }
    } catch (error: any) {
      console.error('Error updating community:', error);
      if (Platform.OS === 'web') {
        alert(`Failed to update: ${error.message}`);
      } else {
        Alert.alert('Error', error.message || 'Failed to update community');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleToggleInviteCode = async () => {
    if (!community) return;
    setTogglingInviteCode(true);

    try {
      const newEnabled = !community.invite_code_enabled;
      const { data, error } = await supabase.rpc('toggle_invite_code', {
        p_community_id: community.id,
        p_enabled: newEnabled,
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string; invite_code?: string };
      if (!result.success) {
        throw new Error(result.error || 'Failed to update invite code setting');
      }

      // Update local state
      setCommunity({
        ...community,
        invite_code_enabled: newEnabled,
        invite_code: result.invite_code || community.invite_code,
      });

      if (Platform.OS !== 'web') {
        Alert.alert('Success', newEnabled ? 'Invite code enabled' : 'Invite code disabled');
      }
    } catch (error: any) {
      console.error('Error toggling invite code:', error);
      if (Platform.OS === 'web') {
        alert(`Failed to update: ${error.message}`);
      } else {
        Alert.alert('Error', error.message || 'Failed to update invite code setting');
      }
    } finally {
      setTogglingInviteCode(false);
    }
  };

  const handleInviteFriend = async (friendId: string) => {
    if (!community) return;

    setInvitingFriends((prev) => new Set(prev).add(friendId));

    try {
      const { data, error } = await supabase.rpc('invite_to_community', {
        p_community_id: community.id,
        p_invitee_id: friendId,
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string };
      if (!result.success) {
        throw new Error(result.error || 'Failed to send invite');
      }

      // Remove from friends list
      setFriends((prev) => prev.filter((f) => f.id !== friendId));

      if (Platform.OS !== 'web') {
        Alert.alert('Success', 'Invite sent!');
      }
    } catch (error: any) {
      console.error('Error inviting friend:', error);
      if (Platform.OS === 'web') {
        alert(`Failed to invite: ${error.message}`);
      } else {
        Alert.alert('Error', error.message || 'Failed to send invite');
      }
    } finally {
      setInvitingFriends((prev) => {
        const newSet = new Set(prev);
        newSet.delete(friendId);
        return newSet;
      });
    }
  };

  const handleKickMember = (member: Member) => {
    if (member.role === 'owner') {
      Alert.alert('Cannot Remove', 'The community owner cannot be removed.');
      return;
    }

    const confirmKick = async () => {
      try {
        const { data, error } = await supabase.rpc('kick_community_member', {
          p_community_id: community!.id,
          p_member_id: member.user_id,
        });

        if (error) throw error;

        const result = data as { success: boolean; error?: string };
        if (!result.success) {
          throw new Error(result.error || 'Failed to remove member');
        }

        // Update local state
        setMembers((prev) => prev.filter((m) => m.user_id !== member.user_id));

        if (Platform.OS === 'web') {
          alert(`${member.nickname} has been removed from the community.`);
        } else {
          Alert.alert('Success', `${member.nickname} has been removed from the community.`);
        }
      } catch (error: any) {
        console.error('Error kicking member:', error);
        if (Platform.OS === 'web') {
          alert(`Failed to remove: ${error.message}`);
        } else {
          Alert.alert('Error', error.message || 'Failed to remove member');
        }
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Remove ${member.nickname} from the community?`)) {
        confirmKick();
      }
    } else {
      Alert.alert(
        'Remove Member',
        `Are you sure you want to remove ${member.nickname} from the community?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Remove', style: 'destructive', onPress: confirmKick },
        ]
      );
    }
  };

  const renderMemberItem = ({ item }: { item: Member }) => {
    const isOwner = item.role === 'owner';
    const canKick = (userRole === 'owner' || userRole === 'admin') && !isOwner && item.user_id !== session?.user?.id;

    return (
      <View style={[styles.memberItem, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        <UserAvatar
          profilePictureUrl={null}
          icon={item.avatar_icon as keyof typeof Ionicons.glyphMap}
          iconColor={item.avatar_icon_color}
          backgroundColor={item.avatar_background_color}
          size={44}
        />
        <View style={styles.memberInfo}>
          <View style={styles.memberNameRow}>
            <ThemedText variant="body" style={styles.memberName}>
              {item.nickname}
            </ThemedText>
            {isOwner && (
              <View style={[styles.roleBadge, { backgroundColor: theme.colors.primary }]}>
                <Ionicons name="star" size={10} color="#FFFFFF" />
                <ThemedText variant="caption" style={styles.roleText}>
                  Owner
                </ThemedText>
              </View>
            )}
            {item.role === 'admin' && (
              <View style={[styles.roleBadge, { backgroundColor: theme.colors.warning }]}>
                <ThemedText variant="caption" style={styles.roleText}>
                  Admin
                </ThemedText>
              </View>
            )}
          </View>
          <ThemedText variant="caption" style={{ color: theme.colors.textSecondary }}>
            @{item.username}
          </ThemedText>
        </View>
        {canKick && (
          <TouchableOpacity
            style={[styles.kickButton, { backgroundColor: theme.colors.error + '15' }]}
            onPress={() => handleKickMember(item)}
          >
            <Ionicons name="remove-circle" size={20} color={theme.colors.error} />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderFriendItem = ({ item }: { item: UserProfile }) => {
    const isInviting = invitingFriends.has(item.id);

    return (
      <View style={[styles.friendItem, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        <UserAvatar
          profilePictureUrl={null}
          icon={item.avatar_icon as keyof typeof Ionicons.glyphMap}
          iconColor={item.avatar_icon_color}
          backgroundColor={item.avatar_background_color}
          size={40}
        />
        <View style={styles.friendInfo}>
          <ThemedText variant="body" style={styles.friendName}>
            {item.nickname}
          </ThemedText>
          <ThemedText variant="caption" style={{ color: theme.colors.textSecondary }}>
            @{item.username}
          </ThemedText>
        </View>
        <ThemedButton
          title={isInviting ? 'Sending...' : 'Invite'}
          size="small"
          onPress={() => handleInviteFriend(item.id)}
          loading={isInviting}
          disabled={isInviting}
        />
      </View>
    );
  };

  const renderColorItem = (color: string, isSelected: boolean, onSelect: () => void) => (
    <TouchableOpacity
      key={color}
      style={[
        styles.colorSwatch,
        {
          backgroundColor: color,
          borderWidth: isSelected ? 3 : 1,
          borderColor: isSelected ? theme.colors.primary : theme.colors.border,
        },
      ]}
      onPress={onSelect}
    >
      {isSelected && (
        <Ionicons name="checkmark" size={20} color={color === '#FFFFFF' ? '#000' : '#FFF'} />
      )}
    </TouchableOpacity>
  );

  const renderIconItem = ({ item }: { item: (typeof COMMUNITY_ICONS)[number] }) => (
    <TouchableOpacity
      style={[
        styles.iconItem,
        {
          backgroundColor: editIcon === item.name ? theme.colors.primary : theme.colors.card,
          borderColor: editIcon === item.name ? theme.colors.primary : theme.colors.border,
        },
      ]}
      onPress={() => {
        setEditIcon(item.name);
        setShowIconPicker(false);
      }}
    >
      <Ionicons
        name={item.name as keyof typeof Ionicons.glyphMap}
        size={32}
        color={editIcon === item.name ? '#FFFFFF' : theme.colors.text}
      />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <ThemedText style={{ marginTop: 16 }}>Loading community...</ThemedText>
      </ThemedView>
    );
  }

  if (!community) {
    return (
      <ThemedView style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={48} color={theme.colors.error} />
        <ThemedText variant="subtitle" style={{ marginTop: 16 }}>
          Community not found
        </ThemedText>
        <ThemedButton title="Go Back" onPress={() => router.back()} style={{ marginTop: 24 }} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <HapticBackButton onPress={() => router.back()} color={theme.colors.primary} />
        <ThemedText variant="title" style={styles.headerTitle}>
          Manage Community
        </ThemedText>
        {userRole === 'owner' && !editMode && (
          <TouchableOpacity onPress={() => setEditMode(true)}>
            <Ionicons name="pencil" size={24} color={theme.colors.primary} />
          </TouchableOpacity>
        )}
        {editMode && (
          <TouchableOpacity onPress={() => setEditMode(false)}>
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>
        )}
        {!editMode && userRole !== 'owner' && <View style={{ width: 24 }} />}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {/* Community Info Card */}
        <ThemedView variant="card" style={styles.infoCard}>
          {editMode ? (
            <>
              {/* Edit Mode */}
              <View style={styles.editPreview}>
                <CommunityIcon
                  icon={editIcon}
                  iconColor={editIconColor}
                  backgroundColor={editBgColor}
                  size={80}
                />
              </View>

              <View style={styles.editSection}>
                <ThemedText variant="caption" style={styles.editLabel}>
                  Name
                </ThemedText>
                <ThemedInput
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Community name"
                  maxLength={50}
                />
              </View>

              <View style={styles.editSection}>
                <ThemedText variant="caption" style={styles.editLabel}>
                  Icon
                </ThemedText>
                <TouchableOpacity
                  style={[styles.editButton, { borderColor: theme.colors.border }]}
                  onPress={() => setShowIconPicker(true)}
                >
                  <Ionicons name={editIcon as keyof typeof Ionicons.glyphMap} size={24} color={theme.colors.text} />
                  <ThemedText style={{ marginLeft: 12 }}>Change Icon</ThemedText>
                  <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} style={{ marginLeft: 'auto' }} />
                </TouchableOpacity>
              </View>

              <View style={styles.editSection}>
                <ThemedText variant="caption" style={styles.editLabel}>
                  Icon Color
                </ThemedText>
                <TouchableOpacity
                  style={[styles.editButton, { borderColor: theme.colors.border }]}
                  onPress={() => setShowIconColorPicker(true)}
                >
                  <View style={[styles.colorDot, { backgroundColor: editIconColor }]} />
                  <ThemedText style={{ marginLeft: 12 }}>Change Color</ThemedText>
                  <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} style={{ marginLeft: 'auto' }} />
                </TouchableOpacity>
              </View>

              <View style={styles.editSection}>
                <ThemedText variant="caption" style={styles.editLabel}>
                  Background Color
                </ThemedText>
                <TouchableOpacity
                  style={[styles.editButton, { borderColor: theme.colors.border }]}
                  onPress={() => setShowBgColorPicker(true)}
                >
                  <View style={[styles.colorDot, { backgroundColor: editBgColor }]} />
                  <ThemedText style={{ marginLeft: 12 }}>Change Color</ThemedText>
                  <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} style={{ marginLeft: 'auto' }} />
                </TouchableOpacity>
              </View>

              <ThemedButton
                title={saving ? 'Saving...' : 'Save Changes'}
                onPress={handleSaveChanges}
                loading={saving}
                disabled={saving || !editName.trim()}
                style={{ marginTop: 16 }}
              />
            </>
          ) : (
            <>
              {/* View Mode */}
              <View style={styles.communityHeader}>
                <CommunityIcon
                  icon={community.icon}
                  iconColor={community.icon_color}
                  backgroundColor={community.background_color}
                  size={80}
                />
                <ThemedText variant="title" style={styles.communityName}>
                  {community.name}
                </ThemedText>
                {community.is_private && (
                  <View style={[styles.privateBadge, { backgroundColor: theme.colors.primary + '20' }]}>
                    <Ionicons name="lock-closed" size={14} color={theme.colors.primary} />
                    <ThemedText variant="caption" style={{ color: theme.colors.primary, marginLeft: 4 }}>
                      Private Community
                    </ThemedText>
                  </View>
                )}
              </View>

              {community.invite_code && userRole === 'owner' && (
                <View style={[styles.inviteCodeSection, { backgroundColor: theme.colors.inputBackground }]}>
                  {/* Only show invite code when enabled */}
                  {community.invite_code_enabled && (
                    <View style={styles.inviteCodeHeader}>
                      <View style={{ flex: 1 }}>
                        <ThemedText variant="caption" style={{ color: theme.colors.textSecondary }}>
                          Invite Code
                        </ThemedText>
                        <ThemedText variant="subtitle" style={styles.inviteCode}>
                          {community.invite_code}
                        </ThemedText>
                      </View>
                    </View>
                  )}
                  
                  {/* Invite Code Toggle - always visible */}
                  <View style={[styles.inviteCodeToggle, { borderTopColor: community.invite_code_enabled ? theme.colors.border : 'transparent', borderTopWidth: community.invite_code_enabled ? 1 : 0, marginTop: community.invite_code_enabled ? 16 : 0, paddingTop: community.invite_code_enabled ? 16 : 0 }]}>
                    <View style={styles.inviteCodeToggleInfo}>
                      <ThemedText variant="body" style={{ fontWeight: '500' }}>
                        Allow join via code
                      </ThemedText>
                      <ThemedText variant="caption" style={{ color: theme.colors.textSecondary }}>
                        {community.invite_code_enabled 
                          ? 'Anyone with the code can join' 
                          : 'Code is hidden. Enable to share.'}
                      </ThemedText>
                    </View>
                    <Switch
                      value={community.invite_code_enabled}
                      onValueChange={handleToggleInviteCode}
                      disabled={togglingInviteCode}
                      trackColor={{ false: theme.colors.border, true: theme.colors.primary + '50' }}
                      thumbColor={community.invite_code_enabled ? theme.colors.primary : '#f4f3f4'}
                    />
                  </View>
                </View>
              )}
            </>
          )}
        </ThemedView>

        {/* Members Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText variant="subtitle">Members ({members.length})</ThemedText>
            {(userRole === 'owner' || userRole === 'admin') && (
              <TouchableOpacity
                style={[styles.inviteButton, { backgroundColor: theme.colors.primary }]}
                onPress={() => {
                  loadFriends();
                  setShowInviteModal(true);
                }}
              >
                <Ionicons name="person-add" size={18} color="#FFFFFF" />
                <ThemedText style={styles.inviteButtonText}>Invite</ThemedText>
              </TouchableOpacity>
            )}
          </View>

          <FlatList
            data={members}
            renderItem={renderMemberItem}
            keyExtractor={(item) => item.user_id}
            scrollEnabled={false}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <ThemedText variant="caption">No members yet</ThemedText>
              </View>
            }
          />
        </View>
      </ScrollView>

      {/* Icon Picker Modal */}
      <Modal visible={showIconPicker} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <ThemedView style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText variant="subtitle">Select Icon</ThemedText>
              <TouchableOpacity onPress={() => setShowIconPicker(false)}>
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={COMMUNITY_ICONS}
              renderItem={renderIconItem}
              keyExtractor={(item) => item.name}
              numColumns={5}
              contentContainerStyle={styles.iconGrid}
            />
          </ThemedView>
        </View>
      </Modal>

      {/* Icon Color Picker Modal */}
      <Modal visible={showIconColorPicker} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <ThemedView style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText variant="subtitle">Icon Color</ThemedText>
              <TouchableOpacity onPress={() => setShowIconColorPicker(false)}>
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.colorGrid}>
              {AVATAR_COLORS.map((color) =>
                renderColorItem(color, editIconColor === color, () => {
                  setEditIconColor(color);
                  setShowIconColorPicker(false);
                })
              )}
            </View>
          </ThemedView>
        </View>
      </Modal>

      {/* Background Color Picker Modal */}
      <Modal visible={showBgColorPicker} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <ThemedView style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText variant="subtitle">Background Color</ThemedText>
              <TouchableOpacity onPress={() => setShowBgColorPicker(false)}>
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.colorGrid}>
              {AVATAR_COLORS.map((color) =>
                renderColorItem(color, editBgColor === color, () => {
                  setEditBgColor(color);
                  setShowBgColorPicker(false);
                })
              )}
            </View>
          </ThemedView>
        </View>
      </Modal>

      {/* Invite Friends Modal */}
      <Modal visible={showInviteModal} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <ThemedView style={[styles.modalContent, { maxHeight: '80%' }]}>
            <View style={styles.modalHeader}>
              <ThemedText variant="subtitle">Invite Friends</ThemedText>
              <TouchableOpacity onPress={() => setShowInviteModal(false)}>
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            {loadingFriends ? (
              <View style={styles.loadingInner}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
              </View>
            ) : friends.length === 0 ? (
              <View style={styles.emptyInvite}>
                <Ionicons name="people-outline" size={48} color={theme.colors.textSecondary} />
                <ThemedText variant="body" style={{ marginTop: 12 }}>
                  No friends to invite
                </ThemedText>
                <ThemedText
                  variant="caption"
                  style={{ color: theme.colors.textSecondary, textAlign: 'center', marginTop: 4 }}
                >
                  All your friends are already members or you haven&apos;t added any friends yet
                </ThemedText>
              </View>
            ) : (
              <FlatList
                data={friends}
                renderItem={renderFriendItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.friendList}
              />
            )}
          </ThemedView>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  infoCard: {
    padding: 20,
    marginBottom: 24,
  },
  communityHeader: {
    alignItems: 'center',
  },
  communityName: {
    marginTop: 12,
    textAlign: 'center',
  },
  privateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 12,
  },
  inviteCodeSection: {
    marginTop: 20,
    padding: 16,
    borderRadius: 12,
  },
  inviteCodeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inviteCode: {
    letterSpacing: 2,
    marginTop: 4,
  },
  inviteCodeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  inviteCodeToggleInfo: {
    flex: 1,
    marginRight: 12,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  inviteButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  memberInfo: {
    flex: 1,
    marginLeft: 12,
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  memberName: {
    fontWeight: '600',
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    gap: 4,
  },
  roleText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  kickButton: {
    padding: 8,
    borderRadius: 8,
  },
  emptyState: {
    padding: 20,
    alignItems: 'center',
  },
  // Edit mode styles
  editPreview: {
    alignItems: 'center',
    marginBottom: 20,
  },
  editSection: {
    marginBottom: 16,
  },
  editLabel: {
    marginBottom: 8,
    opacity: 0.7,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  colorDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  iconGrid: {
    paddingBottom: 20,
  },
  iconItem: {
    width: (width - 80) / 5,
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 4,
    borderRadius: 12,
    borderWidth: 2,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    paddingBottom: 20,
  },
  colorSwatch: {
    width: COLOR_SWATCH_SIZE,
    height: COLOR_SWATCH_SIZE,
    borderRadius: COLOR_SWATCH_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  friendList: {
    paddingBottom: 16,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  friendInfo: {
    flex: 1,
    marginLeft: 12,
  },
  friendName: {
    fontWeight: '600',
  },
  loadingInner: {
    padding: 40,
    alignItems: 'center',
  },
  emptyInvite: {
    padding: 40,
    alignItems: 'center',
  },
});

