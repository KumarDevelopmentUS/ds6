// app/(tabs)/settings.tsx
import { supabase } from '@/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, TouchableOpacity, View } from 'react-native';
import { ThemedButton } from '../../components/themed/ThemedButton';
import { ThemedText } from '../../components/themed/ThemedText';
import { ThemedView } from '../../components/themed/ThemedView';
import { useTheme } from '../../contexts/ThemeContext';

export default function AccountScreen() {
  const router = useRouter();
  const { theme, colorScheme, toggleColorScheme } = useTheme();
  const [user, setUser] = useState<any>(null);
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

  useEffect(() => {
    loadUserAndProfile();
  }, []);

  const loadUserAndProfile = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const currentUser = session?.user || null;
    setUser(currentUser);

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
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            await supabase.auth.signOut();
            router.replace('/(auth)/login');
          },
        },
      ]
    );
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
      title: 'Game Settings',
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
          value: true,
          onToggle: () => {},
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
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* User Info */}
      {user && profile ? (
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
          <ThemedText variant="caption">{user.email}</ThemedText>
        </ThemedView>
      ) : (
        <ThemedText style={styles.guestText}>Loading user profile...</ThemedText>
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
      {user && (
        <ThemedButton
          title="Logout"
          variant="secondary"
          onPress={handleLogout}
          loading={loading}
          style={styles.logoutButton}
          icon={<Ionicons name="log-out-outline" size={24} color={theme.colors.error} />}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
});
