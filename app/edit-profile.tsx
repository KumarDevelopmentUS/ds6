// app/edit-profile.tsx
import { supabase } from '@/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query'; // 1. Import useQueryClient
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
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { ThemedButton } from '../components/themed/ThemedButton';
import { ThemedInput } from '../components/themed/ThemedInput';
import { ThemedText } from '../components/themed/ThemedText';
import { ThemedView } from '../components/themed/ThemedView';
import { AVATAR_COLORS, FUN_AVATAR_ICONS } from '../constants/avatarIcons';
import { getSchoolByValue, SCHOOLS, searchSchools } from '../constants/schools';
import { useTheme } from '../contexts/ThemeContext';

const { width } = Dimensions.get('window');
const ICON_SIZE = 60;
const COLOR_SWATCH_SIZE = 40;

export default function EditProfileScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const queryClient = useQueryClient(); // 2. Get the query client instance
  const [loading, setLoading] = useState(true);
  
  const [profile, setProfile] = useState<{
    id: string;
    username: string;
    nickname: string;
    school: string;
    schoolName: string;
    avatar_icon: keyof typeof Ionicons.glyphMap | null;
    avatar_icon_color: string | null;
    avatar_background_color: string | null;
  } | null>(null);

  const [showIconPicker, setShowIconPicker] = useState(false);
  const [showIconColorPicker, setShowIconColorPicker] = useState(false);
  const [showBgColorPicker, setShowBgColorPicker] = useState(false);
  const [showSchoolPicker, setShowSchoolPicker] = useState(false);
  const [schoolSearch, setSchoolSearch] = useState('');
  const [filteredSchools, setFilteredSchools] = useState(SCHOOLS);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nickname, school, avatar_icon, avatar_icon_color, avatar_background_color')
        .eq('id', user.id)
        .single();

      const { data: userProfile, error: userProfileError } = await supabase
        .from('user_profiles')
        .select('username, display_name')
        .eq('id', user.id)
        .single();

      if (error || userProfileError) {
        console.error('Error loading profile for edit:', error?.message || userProfileError?.message);
        Alert.alert('Error', 'Failed to load profile data.');
        router.back();
      } else if (data && userProfile) {
        const schoolObject = getSchoolByValue(data.school);
        setProfile({
          ...data,
          username: userProfile.username,
          nickname: data.nickname || userProfile.display_name,
          schoolName: schoolObject ? schoolObject.name : '',
          avatar_icon: data.avatar_icon || 'person',
          avatar_icon_color: data.avatar_icon_color || '#FFFFFF',
          avatar_background_color: data.avatar_background_color || theme.colors.primary,
        });
      }
    } else {
      Alert.alert('Authentication Required', 'You must be logged in to edit your profile.');
      router.replace('/(auth)/login');
    }
    setLoading(false);
  };

  const handleUpdateProfile = async () => {
    if (!profile) return;
    setLoading(true);
    
    const { nickname, school, avatar_icon, avatar_icon_color, avatar_background_color } = profile;

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ nickname, school, avatar_icon, avatar_icon_color, avatar_background_color })
      .eq('id', profile.id);

    const { error: userProfileError } = await supabase
      .from('user_profiles')
      .update({ display_name: nickname })
      .eq('id', profile.id);

    setLoading(false);

    if (profileError || userProfileError) {
      Alert.alert('Update Error', profileError?.message || userProfileError?.message);
    } else {
      // 3. Invalidate the userCommunities query to force a refetch on the feed screen
      await queryClient.invalidateQueries({ queryKey: ['userCommunities'] });

      Alert.alert('Success', 'Profile updated successfully!');
      router.back();
    }
  };

  const selectIcon = (iconName: keyof typeof Ionicons.glyphMap) => {
    setProfile(prev => prev ? { ...prev, avatar_icon: iconName } : null);
    setShowIconPicker(false);
  };

  const selectIconColor = (color: string) => {
    setProfile(prev => prev ? { ...prev, avatar_icon_color: color } : null);
    setShowIconColorPicker(false);
  };

  const selectBgColor = (color: string) => {
    setProfile(prev => prev ? { ...prev, avatar_background_color: color } : null);
    setShowBgColorPicker(false);
  };
  
  const handleSchoolSearch = (text: string) => {
    setSchoolSearch(text);
    setFilteredSchools(searchSchools(text));
  };

  const selectSchool = (school: { name: string; value: string }) => {
    setProfile(prev => prev ? { ...prev, school: school.value, schoolName: school.name } : null);
    setShowSchoolPicker(false);
    setSchoolSearch('');
  };

  if (loading || !profile) {
    return (
      <ThemedView style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <ThemedText style={{ marginTop: 10 }}>Loading profile...</ThemedText>
      </ThemedView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          <ThemedText style={styles.backText}>Back</ThemedText>
        </TouchableOpacity>

        <ThemedText variant="title" style={styles.screenTitle}>
          Edit Profile
        </ThemedText>

        <ThemedView variant="card" style={styles.avatarCustomizationCard}>
          <ThemedText variant="subtitle" style={styles.avatarSectionTitle}>Your Avatar</ThemedText>
          <View style={[styles.avatarPreview, { backgroundColor: profile.avatar_background_color || theme.colors.primary }]}>
            <Ionicons name={profile.avatar_icon || 'person'} size={60} color={profile.avatar_icon_color || '#FFFFFF'} />
          </View>

          <TouchableOpacity style={[styles.selectionRow, { borderColor: theme.colors.border }]} onPress={() => setShowIconPicker(true)}>
            <ThemedText>Change Icon</ThemedText>
            <View style={styles.selectionValueContainer}>
              <Ionicons name={profile.avatar_icon || 'person'} size={24} color={theme.colors.textSecondary} />
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.selectionRow, { borderColor: theme.colors.border }]} onPress={() => setShowIconColorPicker(true)}>
            <ThemedText>Icon Color</ThemedText>
            <View style={styles.selectionValueContainer}>
              <View style={[styles.colorSwatch, { backgroundColor: profile.avatar_icon_color || '#FFFFFF' }]} />
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.selectionRow, { borderColor: theme.colors.border }]} onPress={() => setShowBgColorPicker(true)}>
            <ThemedText>Background Color</ThemedText>
            <View style={styles.selectionValueContainer}>
              <View style={[styles.colorSwatch, { backgroundColor: profile.avatar_background_color || theme.colors.primary }]} />
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
            </View>
          </TouchableOpacity>
        </ThemedView>

        <ThemedView variant="card" style={styles.formCard}>
          <ThemedText style={{ marginBottom: 4 }}>Username (cannot be changed)</ThemedText>
          <View style={styles.disabledInput}>
            <Ionicons name="person-circle-outline" size={20} color={theme.colors.textSecondary} />
            <ThemedText style={{ marginLeft: 10 }}>{profile.username}</ThemedText>
          </View>

          <ThemedText style={{ marginTop: theme.spacing.md, marginBottom: 4 }}>Nickname</ThemedText>
          <ThemedInput
            value={profile.nickname}
            onChangeText={(text) => setProfile({ ...profile, nickname: text })}
            icon={<Ionicons name="at-outline" size={20} color={theme.colors.textSecondary} />}
          />
          
          <ThemedText style={{ marginTop: theme.spacing.md, marginBottom: 4 }}>School</ThemedText>
          <TouchableOpacity style={styles.schoolSelector} onPress={() => setShowSchoolPicker(true)}>
            <Ionicons name="school-outline" size={20} color={theme.colors.textSecondary} />
            <ThemedText style={styles.schoolText} numberOfLines={1}>
              {profile.schoolName || 'Select School'}
            </ThemedText>
            <Ionicons name="chevron-down" size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>

          <ThemedButton
            title="Save Changes"
            onPress={handleUpdateProfile}
            loading={loading}
            style={{ marginTop: theme.spacing.lg }}
          />
        </ThemedView>

        {/* --- Modals for selection --- */}
        <Modal visible={showIconPicker} animationType="slide" transparent={true} onRequestClose={() => setShowIconPicker(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: theme.colors.background }]}>
              <View style={styles.modalHeader}>
                <ThemedText variant="subtitle">Select Icon</ThemedText>
                <TouchableOpacity onPress={() => setShowIconPicker(false)}>
                  <Ionicons name="close" size={24} color={theme.colors.text} />
                </TouchableOpacity>
              </View>
              <FlatList
                data={FUN_AVATAR_ICONS}
                keyExtractor={(item) => item.name}
                numColumns={4}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.iconItem} onPress={() => selectIcon(item.name)}>
                    <Ionicons name={item.name} size={ICON_SIZE / 1.5} color={theme.colors.textSecondary} />
                    <ThemedText variant="caption" style={{ textAlign: 'center', marginTop: 4 }}>{item.label}</ThemedText>
                  </TouchableOpacity>
                )}
              />
            </View>
          </View>
        </Modal>
        
        <Modal visible={showIconColorPicker} animationType="slide" transparent={true} onRequestClose={() => setShowIconColorPicker(false)}>
           <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: theme.colors.background }]}>
              <View style={styles.modalHeader}>
                <ThemedText variant="subtitle">Select Icon Color</ThemedText>
                <TouchableOpacity onPress={() => setShowIconColorPicker(false)}>
                  <Ionicons name="close" size={24} color={theme.colors.text} />
                </TouchableOpacity>
              </View>
              <FlatList data={AVATAR_COLORS} keyExtractor={(item) => item} numColumns={Math.floor(width / (COLOR_SWATCH_SIZE + 20))} renderItem={({ item }) => (<TouchableOpacity style={[styles.colorItem, { backgroundColor: item }]} onPress={() => selectIconColor(item)}>{profile.avatar_icon_color === item && (<Ionicons name="checkmark-circle" size={24} color="#FFFFFF" />)}</TouchableOpacity>)} />
            </View>
          </View>
        </Modal>

        <Modal visible={showBgColorPicker} animationType="slide" transparent={true} onRequestClose={() => setShowBgColorPicker(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: theme.colors.background }]}>
              <View style={styles.modalHeader}>
                <ThemedText variant="subtitle">Select Background Color</ThemedText>
                <TouchableOpacity onPress={() => setShowBgColorPicker(false)}>
                  <Ionicons name="close" size={24} color={theme.colors.text} />
                </TouchableOpacity>
              </View>
              <FlatList data={AVATAR_COLORS} keyExtractor={(item) => item} numColumns={Math.floor(width / (COLOR_SWATCH_SIZE + 20))} renderItem={({ item }) => (<TouchableOpacity style={[styles.colorItem, { backgroundColor: item }]} onPress={() => selectBgColor(item)}>{profile.avatar_background_color === item && (<Ionicons name="checkmark-circle" size={24} color="#FFFFFF" />)}</TouchableOpacity>)} />
            </View>
          </View>
        </Modal>
        
        <Modal visible={showSchoolPicker} animationType="slide" transparent={true} onRequestClose={() => setShowSchoolPicker(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
            <View style={styles.modalOverlay}>
              <View style={[styles.modalContent, { backgroundColor: theme.colors.background }]}>
                <View style={styles.modalHeader}>
                  <ThemedText variant="subtitle">Select School</ThemedText>
                  <TouchableOpacity onPress={() => setShowSchoolPicker(false)}>
                    <Ionicons name="close" size={24} color={theme.colors.text} />
                  </TouchableOpacity>
                </View>
                <View style={[styles.searchContainer, { backgroundColor: theme.colors.inputBackground }]}>
                  <Ionicons name="search" size={20} color={theme.colors.textSecondary} />
                  <TextInput style={[styles.searchInput, { color: theme.colors.text }]} placeholder="Search schools..." placeholderTextColor={theme.colors.textSecondary} value={schoolSearch} onChangeText={handleSchoolSearch} />
                </View>
                <FlatList data={filteredSchools} keyExtractor={(item) => item.id} renderItem={({ item }) => (<TouchableOpacity style={[styles.schoolItem, { borderBottomColor: theme.colors.border }]} onPress={() => selectSchool(item)}><ThemedText>{item.name}</ThemedText></TouchableOpacity>)} ListEmptyComponent={<View style={styles.emptyContainer}><ThemedText variant="caption">No schools found</ThemedText></View>} />
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { justifyContent: 'center', alignItems: 'center' },
  content: { padding: 20, paddingBottom: 40, alignItems: 'center' },
  backButton: { position: 'absolute', top: 60, left: 20, flexDirection: 'row', alignItems: 'center', zIndex: 10 },
  backText: { marginLeft: 8, fontSize: 16, fontWeight: '500' },
  screenTitle: { textAlign: 'center', marginBottom: 30, marginTop: 80 },
  avatarCustomizationCard: { width: '100%', maxWidth: 400, padding: 20, borderRadius: 10, marginBottom: 32, alignItems: 'center' },
  avatarSectionTitle: { marginBottom: 20, fontWeight: '600' },
  avatarPreview: { width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center', marginBottom: 20, borderWidth: 2, borderColor: '#e5e7eb' },
  selectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', paddingVertical: 15, borderBottomWidth: 1 },
  selectionValueContainer: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  colorSwatch: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: '#ccc' },
  formCard: { width: '100%', maxWidth: 400, padding: 20, borderRadius: 10 },
  disabledInput: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#e9ecef', padding: 15, borderRadius: 8, gap: 10 },
  schoolSelector: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 15, backgroundColor: '#f8f9fa' },
  schoolText: { flex: 1, marginLeft: 10 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { borderRadius: 20, padding: 20, maxHeight: '80%', width: '100%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  iconItem: { width: ICON_SIZE + 10, height: ICON_SIZE + 30, justifyContent: 'center', alignItems: 'center', margin: 5, borderRadius: 8 },
  colorItem: { width: COLOR_SWATCH_SIZE, height: COLOR_SWATCH_SIZE, borderRadius: COLOR_SWATCH_SIZE / 2, margin: 5, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#ccc' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 16, gap: 12 },
  searchInput: { flex: 1, fontSize: 16 },
  schoolItem: { paddingVertical: 16, borderBottomWidth: 1 },
  emptyContainer: { paddingVertical: 40, alignItems: 'center' },
});