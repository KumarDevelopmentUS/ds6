// app/create-community.tsx
import { CommunityIcon } from '@/components/CommunityIcon';
import { HapticBackButton } from '@/components/HapticBackButton';
import { UserAvatar } from '@/components/social/UserAvatar';
import { ThemedButton } from '@/components/themed/ThemedButton';
import { ThemedInput } from '@/components/themed/ThemedInput';
import { ThemedText } from '@/components/themed/ThemedText';
import { ThemedView } from '@/components/themed/ThemedView';
import { AVATAR_COLORS, FUN_AVATAR_ICONS } from '@/constants/avatarIcons';
import { useAuth } from '@/contexts/AuthContext';
import { useFeed } from '@/contexts/FeedContext';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';

const { width } = Dimensions.get('window');
const ICON_SIZE = 60;
const COLOR_SWATCH_SIZE = 40;

// Additional community-specific icons
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
  ...FUN_AVATAR_ICONS.filter(
    (icon) => !['people', 'home', 'beer', 'game-controller', 'trophy', 'star', 'heart', 'flame', 'flash', 'rocket'].includes(icon.name)
  ),
] as const;

type UserProfile = {
  id: string;
  username: string;
  nickname: string;
  avatar_icon: string;
  avatar_icon_color: string;
  avatar_background_color: string;
};

export default function CreateCommunityScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { session } = useAuth();
  const { refetch: refetchCommunities } = useFeed();

  const [communityName, setCommunityName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState<string>('people');
  const [selectedIconColor, setSelectedIconColor] = useState('#FFFFFF');
  const [selectedBgColor, setSelectedBgColor] = useState('#007AFF');
  
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [showIconColorPicker, setShowIconColorPicker] = useState(false);
  const [showBgColorPicker, setShowBgColorPicker] = useState(false);
  const [showFriendSelector, setShowFriendSelector] = useState(false);

  const [friends, setFriends] = useState<UserProfile[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<Set<string>>(new Set());
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [creating, setCreating] = useState(false);
  const [nameError, setNameError] = useState('');

  useEffect(() => {
    if (session?.user) {
      loadFriends();
    }
  }, [session?.user]);

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

      if (friendIds.length === 0) {
        setFriends([]);
        setLoadingFriends(false);
        return;
      }

      // Get friend profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select('id, username, nickname, avatar_icon, avatar_icon_color, avatar_background_color')
        .in('id', friendIds);

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

  const toggleFriendSelection = (friendId: string) => {
    setSelectedFriends((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(friendId)) {
        newSet.delete(friendId);
      } else {
        newSet.add(friendId);
      }
      return newSet;
    });
  };

  const validateName = (name: string) => {
    if (!name.trim()) {
      setNameError('Community name is required');
      return false;
    }
    if (name.trim().length < 2) {
      setNameError('Name must be at least 2 characters');
      return false;
    }
    if (name.trim().length > 50) {
      setNameError('Name must be less than 50 characters');
      return false;
    }
    setNameError('');
    return true;
  };

  const handleCreate = async () => {
    if (!validateName(communityName)) return;
    if (!session?.user?.id) {
      Alert.alert('Error', 'You must be logged in to create a community');
      return;
    }

    setCreating(true);

    try {
      // Create the community using the RPC function
      const { data, error } = await supabase.rpc('create_private_community', {
        p_name: communityName.trim(),
        p_description: null,
        p_icon: selectedIcon,
        p_icon_color: selectedIconColor,
        p_background_color: selectedBgColor,
      });

      if (error) throw error;

      const result = data as { success: boolean; community_id?: number; invite_code?: string; error?: string };

      if (!result.success) {
        throw new Error(result.error || 'Failed to create community');
      }

      // Send invites to selected friends
      if (selectedFriends.size > 0 && result.community_id) {
        const invitePromises = Array.from(selectedFriends).map((friendId) =>
          supabase.rpc('invite_to_community', {
            p_community_id: result.community_id!,
            p_invitee_id: friendId,
          })
        );

        await Promise.all(invitePromises);
      }

      // Refresh communities
      refetchCommunities();

      // Show success message
      if (Platform.OS === 'web') {
        alert(`Community "${communityName}" created successfully!${selectedFriends.size > 0 ? ` ${selectedFriends.size} invite(s) sent.` : ''}`);
      } else {
        Alert.alert(
          'Success!',
          `Community "${communityName}" created successfully!${selectedFriends.size > 0 ? `\n${selectedFriends.size} invite(s) sent.` : ''}`,
          [{ text: 'OK' }]
        );
      }

      router.back();
    } catch (error: any) {
      console.error('Error creating community:', error);
      if (Platform.OS === 'web') {
        alert(`Failed to create community: ${error.message}`);
      } else {
        Alert.alert('Error', error.message || 'Failed to create community');
      }
    } finally {
      setCreating(false);
    }
  };

  const renderIconItem = ({ item }: { item: (typeof COMMUNITY_ICONS)[number] }) => (
    <TouchableOpacity
      style={[
        styles.iconItem,
        {
          backgroundColor: selectedIcon === item.name ? theme.colors.primary : theme.colors.card,
          borderColor: selectedIcon === item.name ? theme.colors.primary : theme.colors.border,
        },
      ]}
      onPress={() => {
        setSelectedIcon(item.name);
        setShowIconPicker(false);
      }}
    >
      <Ionicons
        name={item.name as keyof typeof Ionicons.glyphMap}
        size={32}
        color={selectedIcon === item.name ? '#FFFFFF' : theme.colors.text}
      />
    </TouchableOpacity>
  );

  const renderColorItem = (
    color: string,
    isSelected: boolean,
    onSelect: () => void
  ) => (
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

  const renderFriendItem = ({ item }: { item: UserProfile }) => {
    const isSelected = selectedFriends.has(item.id);
    return (
      <TouchableOpacity
        style={[
          styles.friendItem,
          {
            backgroundColor: isSelected ? theme.colors.primary + '20' : theme.colors.card,
            borderColor: isSelected ? theme.colors.primary : theme.colors.border,
          },
        ]}
        onPress={() => toggleFriendSelection(item.id)}
      >
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
        <View
          style={[
            styles.checkbox,
            {
              backgroundColor: isSelected ? theme.colors.primary : 'transparent',
              borderColor: isSelected ? theme.colors.primary : theme.colors.border,
            },
          ]}
        >
          {isSelected && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <HapticBackButton
            onPress={() => router.back()}
            color={theme.colors.primary}
          />
          <ThemedText variant="title" style={styles.headerTitle}>
            Create Community
          </ThemedText>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Preview Card */}
          <ThemedView variant="card" style={styles.previewCard}>
            <ThemedText variant="caption" style={styles.previewLabel}>
              Preview
            </ThemedText>
            <View style={styles.previewContent}>
              <CommunityIcon
                icon={selectedIcon}
                iconColor={selectedIconColor}
                backgroundColor={selectedBgColor}
                size={80}
              />
              <ThemedText variant="subtitle" style={styles.previewName}>
                {communityName || 'Your Community'}
              </ThemedText>
            </View>
          </ThemedView>

          {/* Name Input */}
          <View style={styles.section}>
            <ThemedText variant="subtitle" style={styles.sectionTitle}>
              Community Name
            </ThemedText>
            <ThemedInput
              placeholder="Enter community name..."
              value={communityName}
              onChangeText={(text) => {
                setCommunityName(text);
                if (nameError) validateName(text);
              }}
              onBlur={() => validateName(communityName)}
              maxLength={50}
            />
            {nameError ? (
              <ThemedText variant="caption" style={styles.errorText}>
                {nameError}
              </ThemedText>
            ) : (
              <ThemedText variant="caption" style={styles.charCount}>
                {communityName.length}/50
              </ThemedText>
            )}
          </View>

          {/* Icon Selection */}
          <View style={styles.section}>
            <ThemedText variant="subtitle" style={styles.sectionTitle}>
              Community Icon
            </ThemedText>
            <TouchableOpacity
              style={[styles.selectorButton, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
              onPress={() => setShowIconPicker(true)}
            >
              <CommunityIcon
                icon={selectedIcon}
                iconColor={selectedIconColor}
                backgroundColor={selectedBgColor}
                size={48}
              />
              <ThemedText variant="body" style={styles.selectorText}>
                Change Icon
              </ThemedText>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Color Selection */}
          <View style={styles.section}>
            <ThemedText variant="subtitle" style={styles.sectionTitle}>
              Colors
            </ThemedText>
            
            {/* Icon Color */}
            <TouchableOpacity
              style={[styles.colorSelector, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
              onPress={() => setShowIconColorPicker(true)}
            >
              <View style={styles.colorSelectorLeft}>
                <View style={[styles.colorPreview, { backgroundColor: selectedIconColor }]} />
                <ThemedText variant="body">Icon Color</ThemedText>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>

            {/* Background Color */}
            <TouchableOpacity
              style={[styles.colorSelector, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, marginTop: 12 }]}
              onPress={() => setShowBgColorPicker(true)}
            >
              <View style={styles.colorSelectorLeft}>
                <View style={[styles.colorPreview, { backgroundColor: selectedBgColor }]} />
                <ThemedText variant="body">Background Color</ThemedText>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Invite Friends */}
          <View style={styles.section}>
            <ThemedText variant="subtitle" style={styles.sectionTitle}>
              Invite Friends (Optional)
            </ThemedText>
            <TouchableOpacity
              style={[styles.selectorButton, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
              onPress={() => setShowFriendSelector(true)}
            >
              <View style={[styles.iconCircle, { backgroundColor: theme.colors.primary }]}>
                <Ionicons name="person-add" size={24} color="#FFFFFF" />
              </View>
              <View style={styles.selectorInfo}>
                <ThemedText variant="body">
                  {selectedFriends.size > 0
                    ? `${selectedFriends.size} friend${selectedFriends.size > 1 ? 's' : ''} selected`
                    : 'Select friends to invite'}
                </ThemedText>
                <ThemedText variant="caption" style={{ color: theme.colors.textSecondary }}>
                  You can invite more later
                </ThemedText>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Create Button */}
          <View style={styles.buttonSection}>
            <ThemedButton
              title={creating ? 'Creating...' : 'Create Community'}
              onPress={handleCreate}
              loading={creating}
              disabled={creating || !communityName.trim()}
              style={styles.createButton}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

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
                renderColorItem(color, selectedIconColor === color, () => {
                  setSelectedIconColor(color);
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
                renderColorItem(color, selectedBgColor === color, () => {
                  setSelectedBgColor(color);
                  setShowBgColorPicker(false);
                })
              )}
            </View>
          </ThemedView>
        </View>
      </Modal>

      {/* Friend Selector Modal */}
      <Modal visible={showFriendSelector} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <ThemedView style={[styles.modalContent, { maxHeight: '80%' }]}>
            <View style={styles.modalHeader}>
              <ThemedText variant="subtitle">Select Friends</ThemedText>
              <TouchableOpacity onPress={() => setShowFriendSelector(false)}>
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            {loadingFriends ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
              </View>
            ) : friends.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="people-outline" size={48} color={theme.colors.textSecondary} />
                <ThemedText variant="body" style={styles.emptyText}>
                  No friends to invite yet
                </ThemedText>
                <ThemedText variant="caption" style={{ color: theme.colors.textSecondary, textAlign: 'center' }}>
                  Add friends first, then you can invite them to your community
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

            {friends.length > 0 && (
              <View style={styles.modalFooter}>
                <ThemedButton
                  title={`Done (${selectedFriends.size} selected)`}
                  onPress={() => setShowFriendSelector(false)}
                />
              </View>
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
  previewCard: {
    alignItems: 'center',
    padding: 24,
    marginBottom: 24,
  },
  previewLabel: {
    marginBottom: 16,
    opacity: 0.6,
  },
  previewContent: {
    alignItems: 'center',
    gap: 12,
  },
  previewName: {
    marginTop: 8,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    marginBottom: 12,
  },
  selectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  selectorText: {
    flex: 1,
    marginLeft: 16,
  },
  selectorInfo: {
    flex: 1,
    marginLeft: 16,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  colorSelectorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  colorPreview: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  buttonSection: {
    marginTop: 8,
  },
  createButton: {
    marginBottom: 20,
  },
  errorText: {
    color: '#FF3B30',
    marginTop: 4,
  },
  charCount: {
    marginTop: 4,
    opacity: 0.6,
    textAlign: 'right',
  },
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
  modalFooter: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
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
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    gap: 12,
  },
  emptyText: {
    marginTop: 8,
  },
});

