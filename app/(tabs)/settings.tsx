// app/(tabs)/settings.tsx
import { supabase } from '@/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, SafeAreaView, ScrollView, StyleSheet, Switch, TouchableOpacity, View } from 'react-native';
import { ThemedButton } from '../../components/themed/ThemedButton';
import { ThemedText } from '../../components/themed/ThemedText';
import { ThemedView } from '../../components/themed/ThemedView';
import { useAuth } from '../../contexts/AuthContext';
import { useFeed } from '../../contexts/FeedContext';
import { useHaptics } from '../../contexts/HapticsContext';
import { useTheme } from '../../contexts/ThemeContext';

export default function AccountScreen() {
  const router = useRouter();
  const { theme, colorScheme, toggleColorScheme } = useTheme();
  const { vibrationEnabled, setVibrationEnabled } = useHaptics();
  const { communities: userCommunities, isLoading: communitiesLoading } = useFeed();
  const { session } = useAuth();
  const [profile, setProfile] = useState<{
    id: string;
    first_name: string;
    nickname: string;
    school: string;
    avatar_icon: keyof typeof Ionicons.glyphMap;
    avatar_icon_color: string;
    avatar_background_color: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    loadUserAndProfile();
  }, [session]);

  const loadUserAndProfile = async () => {
    setLoading(true);
    const currentUser = session?.user || null;

    if (currentUser) {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, nickname, school, avatar_icon, avatar_icon_color, avatar_background_color')
        .eq('id', currentUser.id)
        .single();

      if (error) {
        console.error('Error loading profile:', error.message);
        Alert.alert('Error', 'Failed to load profile data.');
      } else if (data) {
        setProfile(data);
      }
    } else {
      setProfile(null);
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    if (isLoggingOut) {
      console.log('🔴 LOGOUT DEBUG: Already logging out, ignoring call');
      return;
    }
    
    console.log('🔴 LOGOUT DEBUG: handleLogout called');
    setIsLoggingOut(true);
    console.log('🔴 LOGOUT DEBUG: About to show Alert.alert');
    
    // Add a timeout to reset state if Alert doesn't work
    const alertTimeout = setTimeout(() => {
      console.log('🔴 LOGOUT DEBUG: Alert timeout - proceeding with logout');
      performLogout();
    }, 1000); // If no response in 1 second, proceed
    
    try {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
          { 
            text: 'Cancel', 
            style: 'cancel',
            onPress: () => {
              console.log('🔴 LOGOUT DEBUG: User cancelled logout');
              clearTimeout(alertTimeout);
              setIsLoggingOut(false);
            }
          },
        {
          text: 'Logout',
          style: 'destructive',
            onPress: () => {
              console.log('🔴 LOGOUT DEBUG: User confirmed logout');
              clearTimeout(alertTimeout);
              performLogout();
          },
        },
      ]
    );
    } catch (error) {
      console.log('🔴 LOGOUT DEBUG: Alert.alert failed, proceeding directly');
      clearTimeout(alertTimeout);
      performLogout();
    }
    
    console.log('🔴 LOGOUT DEBUG: Alert.alert called, waiting for user response');
  };

  const performLogout = async () => {
    console.log('🔴 LOGOUT DEBUG: performLogout called');
    setLoading(true);
    console.log('🔴 LOGOUT DEBUG: Loading set to true');
    
    try {
      console.log('🔴 LOGOUT DEBUG: Calling supabase.auth.signOut()');
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('🔴 LOGOUT DEBUG: signOut error:', error);
        Alert.alert('Logout Error', error.message);
        setLoading(false);
        setIsLoggingOut(false);
        return;
      }
      
      console.log('🔴 LOGOUT DEBUG: signOut successful, checking session...');
      const { data: { session } } = await supabase.auth.getSession();
      console.log('🔴 LOGOUT DEBUG: Current session after signOut:', session);
      
      console.log('🔴 LOGOUT DEBUG: Navigating to home...');
      router.replace('/(tabs)/home');
      console.log('🔴 LOGOUT DEBUG: Navigation completed');
      
    } catch (error) {
      console.error('🔴 LOGOUT DEBUG: Unexpected error during logout:', error);
      Alert.alert('Error', 'An unexpected error occurred during logout');
    } finally {
      console.log('🔴 LOGOUT DEBUG: Setting loading to false');
      setLoading(false);
      setIsLoggingOut(false);
    }
  };

  const settingsOptions = [
    {
      title: 'Appearance',
      icon: 'moon-outline',
      items: [
        {
          label: 'Dark Mode',
          value: colorScheme === 'dark',
          onToggle: toggleColorScheme,
          type: 'switch' as const,
        },
      ],
    },
    {
      title: 'App Preferences', // Renamed from 'Game Settings'
      icon: 'game-controller-outline',
      items: [
        {
          label: 'Sound Effects',
          value: true,
          onToggle: () => {},
          type: 'switch' as const,
        },
        {
          label: 'Vibration',
          value: vibrationEnabled,
          onToggle: setVibrationEnabled,
          type: 'switch' as const,
        },
      ],
    },
    {
      title: 'Account',
      icon: 'person-outline',
      items: [
        {
          label: 'Edit Profile',
          onPress: () => router.push('/edit-profile'),
          type: 'button' as const,
        },
        {
          label: 'Change Password',
          onPress: () => Alert.alert('Coming Soon', 'Password change will be available soon!'),
          type: 'button' as const,
        },
      ],
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
      {/* User Info */}
      {session?.user && profile ? (
        <ThemedView variant="card" style={styles.userCard}>
          {profile.avatar_icon ? (
            <View style={[
              styles.avatar,
              { backgroundColor: profile.avatar_background_color || theme.colors.primary }
            ]}>
              <Ionicons
                name={profile.avatar_icon}
                size={40}
                color={profile.avatar_icon_color || '#FFFFFF'}
              />
            </View>
          ) : (
            <View style={[styles.avatar, { backgroundColor: theme.colors.primary }]}> 
              <Ionicons name="person" size={40} color="#FFFFFF" />
            </View>
          )}
          <ThemedText variant="subtitle" style={styles.userName}>
            {profile.first_name || profile.nickname || 'Player'}
          </ThemedText>
          {/* Username under nickname */}
          {session.user.user_metadata?.username && (
            <ThemedText variant="caption" style={{ marginBottom: 2, color: theme.colors.textSecondary }}>
              @{session.user.user_metadata.username}
            </ThemedText>
          )}
          <ThemedText variant="caption">{session.user.email}</ThemedText>
        </ThemedView>
      ) : (
        <ThemedText style={styles.guestText}>Loading user profile...</ThemedText>
      )}

      {/* Communities Section */}
      {session?.user && (
        <ThemedView variant="section">
          <View style={styles.sectionHeader}>
            <Ionicons
              name="people-outline"
              size={24}
              color={theme.colors.primary}
            />
            <ThemedText variant="subtitle" style={styles.sectionTitle}>
              My Communities
            </ThemedText>
          </View>

          <ThemedView variant="card">
            {communitiesLoading ? (
              <View style={styles.communitiesLoading}>
                <ThemedText variant="caption">Loading communities...</ThemedText>
              </View>
            ) : userCommunities && userCommunities.length > 0 ? (
              userCommunities.map((membership, index) => (
                <View
                  key={membership.community_id}
                  style={[
                    styles.communityItem,
                    index < userCommunities.length - 1 && styles.communityItemBorder,
                    { borderColor: theme.colors.border }
                  ]}
                >
                  <View style={styles.communityInfo}>
                    <View style={[
                      styles.communityIcon,
                      { 
                        backgroundColor: membership.communities.type === 'school' 
                          ? theme.colors.warning 
                          : theme.colors.info 
                      }
                    ]}>
                      <Ionicons
                        name={membership.communities.type === 'school' ? 'school-outline' : 'globe-outline'}
                        size={20}
                        color="#FFFFFF"
                      />
                    </View>
                    <View style={styles.communityText}>
                      <ThemedText variant="body" style={styles.communityName}>
                        {membership.communities.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </ThemedText>
                      <ThemedText variant="caption" style={styles.communityType}>
                        {membership.communities.type === 'school' ? 'School Community' : 'General Community'}
                      </ThemedText>
                    </View>
                  </View>
                  <View style={styles.communityMeta}>
                    <ThemedText variant="caption" style={styles.joinedDate}>
                      Joined {new Date(membership.joined_at).toLocaleDateString()}
                    </ThemedText>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.noCommunities}>
                <Ionicons
                  name="people-outline"
                  size={48}
                  color={theme.colors.textSecondary}
                  style={styles.noCommunitiesIcon}
                />
                <ThemedText variant="body" style={styles.noCommunitiesText}>
                  You&apos;re not part of any communities yet
                </ThemedText>
                <ThemedText variant="caption" style={styles.noCommunitiesSubtext}>
                  Join communities by selecting a school during signup or ask an admin to add you
                </ThemedText>
              </View>
            )}
          </ThemedView>
        </ThemedView>
      )}

      {/* Settings Sections */}
      {settingsOptions.map((section, sectionIndex) => (
        <ThemedView key={section.title} variant="section">
          <View style={styles.sectionHeader}>
            <Ionicons
              name={section.icon as any}
              size={24}
              color={theme.colors.primary}
            />
            <ThemedText variant="subtitle" style={styles.sectionTitle}>
              {section.title}
            </ThemedText>
          </View>

          <ThemedView variant="card">
            {section.items.map((item, itemIndex) => {
              const uniqueKey = `${section.title}-${item.label}`; // ✅ unique key

              const content = (
                <View
                  style={[
                    styles.settingItem,
                    itemIndex < section.items.length - 1 && styles.settingItemBorder,
                    { borderColor: theme.colors.border }
                  ]}
                >
                  <ThemedText variant="body">{item.label}</ThemedText>
                  {item.type === 'switch' ? (
                    <Switch
                      value={item.value}
                      onValueChange={item.onToggle}
                      trackColor={{
                        false: theme.colors.border,
                        true: theme.colors.primary
                      }}
                      thumbColor={theme.dark ? '#f4f3f4' : '#f4f3f4'}
                    />
                  ) : (
                    <Ionicons
                      name="chevron-forward"
                      size={20}
                      color={theme.colors.textSecondary}
                    />
                  )}
                </View>
              );

              return item.type === 'button' ? (
                <TouchableOpacity key={uniqueKey} onPress={item.onPress}>
                  {content}
                </TouchableOpacity>
              ) : (
                <View key={uniqueKey}>
                  {content}
                </View>
              );
            })}
          </ThemedView>
        </ThemedView>
      ))}

      {/* Logout Button */}
      {session?.user && (
        <ThemedButton
          title="Logout"
          variant="secondary"
          onPress={handleLogout}
          loading={loading || isLoggingOut}
          disabled={isLoggingOut}
          style={styles.logoutButton}
          icon={<Ionicons name="log-out-outline" size={24} color={theme.colors.error} />}
        />
      )}
    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  userCard: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  userName: {
    marginBottom: 4,
  },
  guestText: {
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    marginLeft: 8,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
  },
  settingItemBorder: {
    borderBottomWidth: 1,
  },
  logoutButton: {
    marginTop: 32,
  },
  communitiesLoading: {
    padding: 20,
    alignItems: 'center',
  },
  communityItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 4,
  },
  communityItemBorder: {
    borderBottomWidth: 1,
  },
  communityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  communityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  communityText: {
    flex: 1,
  },
  communityName: {
    fontWeight: '600',
    marginBottom: 2,
  },
  communityType: {
    opacity: 0.7,
  },
  communityMeta: {
    alignItems: 'flex-end',
  },
  joinedDate: {
    opacity: 0.6,
    fontSize: 12,
  },
  noCommunities: {
    padding: 40,
    alignItems: 'center',
  },
  noCommunitiesIcon: {
    marginBottom: 16,
    opacity: 0.5,
  },
  noCommunitiesText: {
    textAlign: 'center',
    marginBottom: 8,
    fontWeight: '500',
  },
  noCommunitiesSubtext: {
    textAlign: 'center',
    opacity: 0.7,
    lineHeight: 18,
  },
});
