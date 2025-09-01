// app/edit-profile.tsx
import { HapticBackButton } from '@/components/HapticBackButton';
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
    Image,
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
import { deleteProfilePicture, pickImage, takePhoto, updateUserProfilePicture, uploadProfilePicture } from '../utils/imageUpload';
import { isPasswordVerified, markPasswordVerified, verifyProfilePicturePassword } from '../utils/profilePicturePassword';

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
    email: string | null;
    avatar_icon: keyof typeof Ionicons.glyphMap | null;
    avatar_icon_color: string | null;
    avatar_background_color: string | null;
    avatar_url: string | null;
  } | null>(null);

  const [showIconPicker, setShowIconPicker] = useState(false);
  const [showIconColorPicker, setShowIconColorPicker] = useState(false);
  const [showBgColorPicker, setShowBgColorPicker] = useState(false);
  const [showSchoolPicker, setShowSchoolPicker] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [pendingAction, setPendingAction] = useState<'upload' | null>(null);
  const [schoolSearch, setSchoolSearch] = useState('');
  const [filteredSchools, setFilteredSchools] = useState(SCHOOLS);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { data: userProfile, error } = await supabase
        .from('user_profiles')
        .select('id, username, display_name, nickname, school, avatar_icon, avatar_icon_color, avatar_background_color, avatar_url')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error loading profile for edit:', error?.message);
        Alert.alert('Error', 'Failed to load profile data.');
        router.back();
      } else if (userProfile) {
        const schoolObject = getSchoolByValue(userProfile.school);
        setProfile({
          id: userProfile.id,
          username: userProfile.username,
          nickname: userProfile.nickname || userProfile.display_name,
          school: userProfile.school,
          schoolName: schoolObject ? schoolObject.name : '',
          email: user.email || null,
          avatar_icon: userProfile.avatar_icon || 'person',
          avatar_icon_color: userProfile.avatar_icon_color || '#FFFFFF',
          avatar_background_color: userProfile.avatar_background_color || theme.colors.primary,
          avatar_url: userProfile.avatar_url,
        });
      }
    } else {
      Alert.alert('Authentication Required', 'You must be logged in to edit your profile.');
      router.replace('/(auth)/login');
    }
    setLoading(false);
  };

  const handleProfilePictureUpload = async () => {
    if (!profile) return;

    // Show web-only message if on web platform
    if (Platform.OS === 'web') {
      Alert.alert(
        'Mobile Only Feature',
        'Profile picture upload is only available on mobile devices. Please use the mobile app to upload or change your profile picture.',
        [{ text: 'OK', style: 'default' }]
      );
      return;
    }

    // Check if password is already verified in this session
    const isVerified = await isPasswordVerified();
    
    if (isVerified) {
      // Password already verified, show photo options
      showPhotoOptions();
    } else {
      // Show password modal for upload action
      setPendingAction('upload');
      setShowPasswordModal(true);
    }
  };

  const showPhotoOptions = () => {
    Alert.alert(
      'Select Photo',
      'Choose how you want to add a profile picture',
      [
        { text: 'Take Photo', onPress: handleTakePhoto },
        { text: 'Choose from Library', onPress: handlePickImage },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handlePasswordSubmit = async () => {
    if (!passwordInput.trim()) {
      setPasswordError('Please enter a password');
      return;
    }

    const isValid = await verifyProfilePicturePassword(passwordInput.trim());
    
    if (isValid) {
      // Password correct - mark as verified and perform pending action
      await markPasswordVerified();
      setShowPasswordModal(false);
      setPasswordInput('');
      setPasswordError('');
      
      if (pendingAction === 'upload') {
        showPhotoOptions();
      }
      
      setPendingAction(null);
    } else {
      // Password incorrect
      setPasswordError('Incorrect password');
      setPasswordInput('');
    }
  };

  const handlePasswordCancel = () => {
    setShowPasswordModal(false);
    setPasswordInput('');
    setPasswordError('');
    setPendingAction(null);
  };

  const handleTakePhoto = async () => {
    if (!profile) return;
    setLoading(true);

    try {
      const result = await takePhoto();
      if (result && !result.canceled && result.assets?.[0]) {
        const uploadResult = await uploadProfilePicture(result.assets[0].uri, profile.id);
        if (uploadResult.success && uploadResult.url) {
          const updateSuccess = await updateUserProfilePicture(profile.id, uploadResult.url);
          if (updateSuccess) {
            setProfile(prev => prev ? { ...prev, avatar_url: uploadResult.url! } : null);
            Alert.alert('Success', 'Profile picture updated successfully!');
          } else {
            Alert.alert('Error', 'Failed to update profile picture');
          }
        } else {
          Alert.alert('Error', uploadResult.error || 'Failed to upload image');
        }
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
    setLoading(false);
  };

  const handlePickImage = async () => {
    if (!profile) return;
    setLoading(true);

    try {
      const result = await pickImage();
      if (result && !result.canceled && result.assets?.[0]) {
        const uploadResult = await uploadProfilePicture(result.assets[0].uri, profile.id);
        if (uploadResult.success && uploadResult.url) {
          const updateSuccess = await updateUserProfilePicture(profile.id, uploadResult.url);
          if (updateSuccess) {
            setProfile(prev => prev ? { ...prev, avatar_url: uploadResult.url! } : null);
            Alert.alert('Success', 'Profile picture updated successfully!');
          } else {
            Alert.alert('Error', 'Failed to update profile picture');
          }
        } else {
          Alert.alert('Error', uploadResult.error || 'Failed to upload image');
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
    setLoading(false);
  };

  const handleRemoveProfilePicture = async () => {
    if (!profile || !profile.avatar_url) return;
    
    console.log('Starting profile picture removal...', { profileId: profile.id, avatarUrl: profile.avatar_url });
    
    Alert.alert(
      'Remove Profile Picture',
      'Are you sure you want to remove your profile picture? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Remove', 
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              console.log('Step 1: Deleting file from storage...');
              // Delete the file from storage
              const deleteSuccess = await deleteProfilePicture(profile.avatar_url!);
              console.log('Storage deletion result:', deleteSuccess);
              
              if (deleteSuccess) {
                console.log('Step 2: Updating user_profiles table...');
                // Update the profile to remove the avatar_url
                const updateSuccess = await updateUserProfilePicture(profile.id, null);
                console.log('User profile update result:', updateSuccess);
                
                if (updateSuccess) {
                  console.log('Step 3: Updating local state...');
                  // Update local state immediately to reflect the change
                  const newProfile = { ...profile, avatar_url: null };
                  // Log profile state without sensitive info
                  const { id, email, ...profileForLog } = newProfile;
                  console.log('New profile state:', profileForLog);
                  setProfile(newProfile);
                  
                  console.log('Step 4: Profile data already updated in unified user_profiles table');
                  
                  console.log('Step 5: Invalidating queries...');
                  // Invalidate queries to ensure UI updates properly across the app
                  await queryClient.invalidateQueries({ queryKey: ['userCommunities'] });
                  await queryClient.invalidateQueries({ queryKey: ['profile', profile.id] });
                  await queryClient.invalidateQueries({ queryKey: ['profile', profile.id] });
                  
                  // Force a refetch of the current profile data
                  await queryClient.refetchQueries({ queryKey: ['profile', profile.id] });
                  
                  console.log('Profile picture removal completed successfully');
                  Alert.alert('Success', 'Profile picture removed successfully!');
                } else {
                  console.error('Failed to update user profile');
                  Alert.alert('Error', 'Failed to update profile after removing picture');
                }
              } else {
                console.error('Failed to delete file from storage');
                Alert.alert('Error', 'Failed to remove profile picture from storage');
              }
            } catch (error) {
              console.error('Error removing profile picture:', error);
              Alert.alert('Error', 'Failed to remove profile picture');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleUpdateProfile = async () => {
    if (!profile) return;
    setLoading(true);
    
    const { nickname, school, avatar_icon, avatar_icon_color, avatar_background_color } = profile;

    // Update only user_profiles table now
    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({ 
        nickname, 
        school, 
        avatar_icon, 
        avatar_icon_color, 
        avatar_background_color,
        display_name: nickname,
        updated_at: new Date().toISOString()
      })
      .eq('id', profile.id);

    setLoading(false);

    if (updateError) {
      Alert.alert('Update Error', updateError.message);
    } else {
      // Invalidate queries to ensure UI updates properly across the app
      await queryClient.invalidateQueries({ queryKey: ['userCommunities'] });
      await queryClient.invalidateQueries({ queryKey: ['user_profiles'] });

      Alert.alert('Success', 'Profile updated successfully!');
      router.replace('/(tabs)/' as any);
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
        <HapticBackButton 
          onPress={() => router.back()} 
          style={styles.backButton}
        />

        <ThemedText variant="title" style={styles.screenTitle}>
          Edit Profile
        </ThemedText>

        <ThemedView variant="card" style={styles.avatarCustomizationCard}>
          <ThemedText variant="subtitle" style={styles.avatarSectionTitle}>Your Avatar</ThemedText>
          
          {/* Profile Picture Preview */}
          <View style={styles.avatarPreview}>
            {profile.avatar_url ? (
              <Image 
                source={{ uri: profile.avatar_url }}
                style={styles.profileImage}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.iconAvatarContainer, { backgroundColor: profile.avatar_background_color || theme.colors.primary }]}>
                <Ionicons name={profile.avatar_icon || 'person'} size={60} color={profile.avatar_icon_color || '#FFFFFF'} />
              </View>
            )}
          </View>
          
          {/* Debug info - remove this later */}
          <View style={{ padding: 10, backgroundColor: '#f0f0f0', borderRadius: 5, marginBottom: 10 }}>
            <ThemedText style={{ fontSize: 12, color: '#666' }}>
              Debug: avatar_url = {profile.avatar_url ? 'EXISTS' : 'NULL'}, 
              icon = {profile.avatar_icon}, 
              color = {profile.avatar_icon_color}, 
              bg = {profile.avatar_background_color}
            </ThemedText>
          </View>

          {/* Remove Profile Picture Button - only show when user has a profile picture */}
          {profile.avatar_url && (
            <TouchableOpacity 
              style={[styles.removeProfilePictureButton, { borderColor: theme.colors.error }]} 
              onPress={handleRemoveProfilePicture}
            >
              <Ionicons name="trash-outline" size={20} color={theme.colors.error} />
              <ThemedText style={[styles.removeProfilePictureText, { color: theme.colors.error }]}>
                Remove Profile Picture
              </ThemedText>
            </TouchableOpacity>
          )}
          
          <ThemedText variant="body" style={styles.iconCustomizationTitle}>
            Icon Avatar
          </ThemedText>

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

          <TouchableOpacity style={[styles.selectionRow, { borderColor: theme.colors.border }]} onPress={handleProfilePictureUpload}>
            <ThemedText>Profile Picture</ThemedText>
            <View style={styles.selectionValueContainer}>
              <Ionicons name="camera" size={24} color={theme.colors.textSecondary} />
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
            </View>
          </TouchableOpacity>
          
          {/* Web-only message for profile picture feature */}
          {Platform.OS === 'web' && (
            <View style={styles.webOnlyMessage}>
              <Ionicons name="phone-portrait" size={16} color={theme.colors.textSecondary} />
              <ThemedText style={styles.webOnlyText}>
                Profile picture upload is not available on web
              </ThemedText>
            </View>
          )}
        </ThemedView>

        <ThemedView variant="card" style={styles.formCard}>
          <ThemedText style={[styles.disabledLabel, { color: theme.colors.textSecondary }]}>Username (cannot be changed)</ThemedText>
          <View style={[styles.disabledInput, { backgroundColor: theme.colors.inputBackground }]}>
            <Ionicons name="at-outline" size={20} color={theme.colors.textSecondary} />
            <ThemedText style={[styles.disabledText, { color: theme.colors.textSecondary }]}>{profile.username}</ThemedText>
          </View>

          <ThemedText style={[{ marginTop: theme.spacing.md, marginBottom: 4 }, styles.disabledLabel, { color: theme.colors.textSecondary }]}>Email (cannot be changed)</ThemedText>
          <View style={[styles.disabledInput, { backgroundColor: theme.colors.inputBackground }]}>
            <Ionicons name="mail-outline" size={20} color={theme.colors.textSecondary} />
            <ThemedText style={[styles.disabledText, { color: theme.colors.textSecondary }]}>{profile.email || 'No email'}</ThemedText>
          </View>

          <ThemedText style={{ marginTop: theme.spacing.md, marginBottom: 4 }}>Nickname</ThemedText>
          <ThemedInput
            value={profile.nickname}
            onChangeText={(text) => setProfile({ ...profile, nickname: text })}
            icon={<Ionicons name="person-circle-outline" size={20} color={theme.colors.textSecondary} />}
            style={styles.editableInput}
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

        {/* Password Modal for Profile Picture Upload */}
        <Modal visible={showPasswordModal} animationType="fade" transparent={true} onRequestClose={handlePasswordCancel}>
          <View style={styles.modalOverlay}>
            <ThemedView variant="card" style={styles.modalContent}>
              <ThemedText variant="subtitle" style={styles.modalTitle}>
                Profile Picture Password
              </ThemedText>
              <ThemedText variant="body" style={styles.modalDescription}>
                Enter password:
              </ThemedText>
              <TextInput
                style={[styles.modalInput, passwordError && { borderColor: '#ef4444' }]}
                placeholder="Enter password..."
                placeholderTextColor={theme.colors.textSecondary}
                value={passwordInput}
                onChangeText={setPasswordInput}
                secureTextEntry={true}
                autoFocus={true}
                autoComplete="off"
                autoCorrect={false}
                onSubmitEditing={handlePasswordSubmit}
              />
              {passwordError ? (
                <ThemedText style={{ color: '#ef4444', marginTop: 8, textAlign: 'center', marginBottom: 20 }}>
                  {passwordError}
                </ThemedText>
              ) : null}
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonSecondary]}
                  onPress={handlePasswordCancel}
                >
                  <ThemedText variant="body">Cancel</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonPrimary]}
                  onPress={handlePasswordSubmit}
                >
                  <ThemedText variant="body" style={{ color: '#fff' }}>Submit</ThemedText>
                </TouchableOpacity>
              </View>
            </ThemedView>
          </View>
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
  avatarPreview: { width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center', marginBottom: 20, borderWidth: 2, borderColor: '#e5e7eb', overflow: 'hidden' },
  profileImage: { width: 100, height: 100, borderRadius: 50 },
  iconAvatarContainer: { width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center' },

  removeProfilePictureButton: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center',
    width: '100%', 
    paddingVertical: 12, 
    paddingHorizontal: 16,
    borderRadius: 8, 
    borderWidth: 1,
    marginBottom: 20,
    gap: 8,
    backgroundColor: 'rgba(255, 59, 48, 0.05)',
  },
  removeProfilePictureText: { 
    fontSize: 16, 
    fontWeight: '500' 
  },

  iconCustomizationTitle: { marginBottom: 16, color: '#6b7280', textAlign: 'center' },
  selectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', paddingVertical: 15, borderBottomWidth: 1 },
  selectionValueContainer: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  colorSwatch: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: '#ccc' },
  formCard: { width: '100%', maxWidth: 400, padding: 20, borderRadius: 10 },
  disabledLabel: { marginBottom: 4, opacity: 0.85 },
  disabledInput: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 15, 
    borderRadius: 8, 
    gap: 10, 
    opacity: 0.8,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
  },
  disabledText: { marginLeft: 10, opacity: 0.9 },
  editableInput: { 
    borderWidth: 1, 
    borderColor: 'rgba(0, 122, 255, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
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
  modalTitle: {
    textAlign: 'center',
    marginBottom: 8,
  },
  modalDescription: {
    textAlign: 'center',
    marginBottom: 20,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonSecondary: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  modalButtonPrimary: {
    backgroundColor: '#007AFF',
  },
  webOnlyMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
    gap: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  webOnlyText: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
    color: 'rgba(0, 0, 0, 0.6)',
  },
});