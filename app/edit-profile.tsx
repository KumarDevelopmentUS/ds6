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
  ImageStyle,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle
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
import { handleSchoolCommunityChange } from '../utils/profileSync';

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
  const [nicknameError, setNicknameError] = useState('');
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
        .select('id, username, nickname, school, avatar_icon, avatar_icon_color, avatar_background_color, avatar_url')
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
          nickname: userProfile.nickname || 'Player',
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
    
    console.log('Starting profile picture removal...');
    
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
                console.log('User profile update completed');
                
                if (updateSuccess) {
                  console.log('Step 3: Updating local state...');
                  // Update local state immediately to reflect the change
                  const newProfile = { ...profile, avatar_url: null };
                  // Log profile state without sensitive info
                  const { id, email, ...profileForLog } = newProfile;
                  console.log('Profile state updated successfully');
                  setProfile(newProfile);
                  
                  console.log('Step 4: Profile data already updated in unified user_profiles table');
                  
                  console.log('Step 5: Invalidating queries...');
                  // Invalidate queries to ensure UI updates properly across the app
                  await queryClient.invalidateQueries({ queryKey: ['userCommunities'] });
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

  const validateNickname = (nickname: string) => {
    if (nickname.length > 0 && nickname.length < 3) {
      return 'Name must be at least 3 characters long';
    }
    if (nickname.length > 15) {
      return 'Name must be no more than 15 characters long';
    }
    if (nickname.length > 0 && !/^[a-zA-Z0-9._]+$/.test(nickname)) {
      return 'Name can only contain letters, numbers, dots (.), and underscores (_)';
    }
    return '';
  };

  const handleNicknameChange = (text: string) => {
    setProfile({ ...profile!, nickname: text });
    const error = validateNickname(text);
    setNicknameError(error);
  };

  const handleUpdateProfile = async () => {
    if (!profile) return;
    setLoading(true);
    
    const { nickname, school, avatar_icon, avatar_icon_color, avatar_background_color } = profile;

    // Validate nickname before saving
    const validationError = validateNickname(nickname || '');
    if (validationError) {
      setLoading(false);
      Alert.alert('Validation Error', validationError);
      return;
    }

    // Get the original profile to compare school changes
    const { data: originalProfile } = await supabase
      .from('user_profiles')
      .select('school')
      .eq('id', profile.id)
      .single();

    const oldSchool = originalProfile?.school;
    const hasSchoolChanged = oldSchool !== school;

    // Update user_profiles table
    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({ 
        nickname, 
        school, 
        avatar_icon, 
        avatar_icon_color, 
        avatar_background_color,
        updated_at: new Date().toISOString()
      })
      .eq('id', profile.id);

    if (updateError) {
      setLoading(false);
      Alert.alert('Update Error', updateError.message);
      return;
    }

    // Handle school community changes if school was updated
    let communityMessage = '';
    if (hasSchoolChanged && school) {
      console.log(`📚 School changed from "${oldSchool}" to "${school}"`);
      const communityResult = await handleSchoolCommunityChange(profile.id, school, oldSchool);
      
      if (communityResult.success && communityResult.addedCommunity) {
        communityMessage = `\n\nYou've been added to the ${communityResult.addedCommunity} community!`;
        if (oldSchool) {
          communityMessage += ` You remain a member of your previous school communities.`;
        }
      } else if (!communityResult.success && communityResult.error) {
        console.warn('School community update failed:', communityResult.error);
        // Don't fail the whole operation, just log the warning
      }
    }

    setLoading(false);

    // Invalidate queries to ensure UI updates properly across the app
    await queryClient.invalidateQueries({ queryKey: ['userCommunities'] });
    await queryClient.invalidateQueries({ queryKey: ['user_profiles'] });

    Alert.alert('Success', `Profile updated successfully!${communityMessage}`);
    router.replace('/(tabs)/' as any);
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
            onChangeText={handleNicknameChange}
            icon={<Ionicons name="person-circle-outline" size={20} color={theme.colors.textSecondary} />}
            style={{ ...styles.editableInput, marginBottom: nicknameError ? 5 : 0 }}
            maxLength={15}
          />
          {nicknameError ? (
            <ThemedText variant="caption" style={[{ color: theme.colors.error, marginBottom: theme.spacing.sm }]}>
              {nicknameError}
            </ThemedText>
          ) : null}
          
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

          {/* Change Password Button */}
          <ThemedButton
            title="Change Password"
            variant="outline"
            onPress={() => {
              console.log('🔐 Change Password button clicked, navigating to reset-password');
              router.push('/(auth)/reset-password' as any);
            }}
            icon={<Ionicons name="key-outline" size={20} color={theme.colors.primary} />}
            style={{ marginTop: theme.spacing.md }}
          />
        </ThemedView>

        {/* --- Modals for selection --- */}
        <Modal visible={showIconPicker} animationType="slide" transparent={true} onRequestClose={() => setShowIconPicker(false)}>
          <TouchableOpacity 
            style={styles.modalOverlay} 
            activeOpacity={1} 
            onPress={() => setShowIconPicker(false)}
          >
            <TouchableOpacity 
              activeOpacity={1} 
              onPress={(e) => e.stopPropagation()}
              style={[styles.modalContent, { backgroundColor: theme.colors.background }]}
            >
              <View style={styles.modalHeader}>
                <ThemedText variant="subtitle">Select Icon</ThemedText>
                <TouchableOpacity 
                  onPress={() => setShowIconPicker(false)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close" size={24} color={theme.colors.text} />
                </TouchableOpacity>
              </View>
              <ScrollView 
                style={styles.modalScrollView}
                contentContainerStyle={styles.modalGridContent}
                showsVerticalScrollIndicator={true}
                bounces={true}
              >
                <View style={styles.iconGrid}>
                  {FUN_AVATAR_ICONS.map((item) => (
                    <TouchableOpacity 
                      key={item.name}
                      style={styles.iconItem} 
                      onPress={() => {
                        console.log('Icon selected:', item.name);
                        selectIcon(item.name);
                      }}
                      activeOpacity={0.6}
                      hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                    >
                      <View style={[
                        styles.iconItemBox,
                        profile.avatar_icon === item.name && styles.selectedIconBox,
                        profile.avatar_icon === item.name && { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary + '20' }
                      ]}>
                        <Ionicons name={item.name} size={36} color="#666" />
                      </View>
                      <ThemedText variant="caption" style={{ textAlign: 'center', marginTop: 6, fontSize: 11 }} numberOfLines={2}>
                        {item.label}
                      </ThemedText>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
        
        <Modal visible={showIconColorPicker} animationType="slide" transparent={true} onRequestClose={() => setShowIconColorPicker(false)}>
          <TouchableOpacity 
            style={styles.modalOverlay} 
            activeOpacity={1} 
            onPress={() => setShowIconColorPicker(false)}
          >
            <TouchableOpacity 
              activeOpacity={1} 
              onPress={(e) => e.stopPropagation()}
              style={[styles.modalContent, { backgroundColor: theme.colors.background }]}
            >
              <View style={styles.modalHeader}>
                <ThemedText variant="subtitle">Select Icon Color</ThemedText>
                <TouchableOpacity 
                  onPress={() => setShowIconColorPicker(false)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close" size={24} color={theme.colors.text} />
                </TouchableOpacity>
              </View>
              <ScrollView 
                style={styles.modalScrollView}
                contentContainerStyle={styles.modalGridContent}
                showsVerticalScrollIndicator={true}
                bounces={true}
              >
                <View style={styles.colorGrid}>
                  {AVATAR_COLORS.map((item) => (
                    <TouchableOpacity 
                      key={item}
                      style={[styles.colorItem, { backgroundColor: item }]} 
                      onPress={() => {
                        console.log('Color selected:', item);
                        selectIconColor(item);
                      }}
                      activeOpacity={0.6}
                      hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                    >
                      {profile.avatar_icon_color === item && (
                        <Ionicons name="checkmark-circle" size={32} color={item === '#FFFFFF' || item === '#f59e0b' ? '#000' : '#FFF'} />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

        <Modal visible={showBgColorPicker} animationType="slide" transparent={true} onRequestClose={() => setShowBgColorPicker(false)}>
          <TouchableOpacity 
            style={styles.modalOverlay} 
            activeOpacity={1} 
            onPress={() => setShowBgColorPicker(false)}
          >
            <TouchableOpacity 
              activeOpacity={1} 
              onPress={(e) => e.stopPropagation()}
              style={[styles.modalContent, { backgroundColor: theme.colors.background }]}
            >
              <View style={styles.modalHeader}>
                <ThemedText variant="subtitle">Select Background Color</ThemedText>
                <TouchableOpacity 
                  onPress={() => setShowBgColorPicker(false)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close" size={24} color={theme.colors.text} />
                </TouchableOpacity>
              </View>
              <ScrollView 
                style={styles.modalScrollView}
                contentContainerStyle={styles.modalGridContent}
                showsVerticalScrollIndicator={true}
                bounces={true}
              >
                <View style={styles.colorGrid}>
                  {AVATAR_COLORS.map((item) => (
                    <TouchableOpacity 
                      key={item}
                      style={[styles.colorItem, { backgroundColor: item }]} 
                      onPress={() => {
                        console.log('Background color selected:', item);
                        selectBgColor(item);
                      }}
                      activeOpacity={0.6}
                      hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                    >
                      {profile.avatar_background_color === item && (
                        <Ionicons name="checkmark-circle" size={32} color={item === '#FFFFFF' || item === '#f59e0b' ? '#000' : '#FFF'} />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </TouchableOpacity>
          </TouchableOpacity>
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

const styles = StyleSheet.create<{
  container: ViewStyle;
  loadingContainer: ViewStyle;
  content: ViewStyle;
  backButton: ViewStyle;
  backText: TextStyle;
  screenTitle: TextStyle;
  avatarCustomizationCard: ViewStyle;
  avatarSectionTitle: TextStyle;
  avatarPreview: ViewStyle;
  profileImage: ImageStyle;
  iconAvatarContainer: ViewStyle;
  removeProfilePictureButton: ViewStyle;
  removeProfilePictureText: TextStyle;
  iconCustomizationTitle: TextStyle;
  selectionRow: ViewStyle;
  selectionValueContainer: ViewStyle;
  colorSwatch: ViewStyle;
  formCard: ViewStyle;
  disabledLabel: TextStyle;
  disabledInput: ViewStyle;
  disabledText: TextStyle;
  editableInput: ViewStyle;
  schoolSelector: ViewStyle;
  schoolText: TextStyle;
  modalOverlay: ViewStyle;
  modalContent: ViewStyle;
  modalHeader: ViewStyle;
  modalScrollView: ViewStyle;
  modalGridContent: ViewStyle;
  iconGrid: ViewStyle;
  iconItem: ViewStyle;
  iconItemBox: ViewStyle;
  selectedIconBox: ViewStyle;
  colorGrid: ViewStyle;
  colorItem: ViewStyle;
  searchContainer: ViewStyle;
  searchInput: TextStyle;
  schoolItem: ViewStyle;
  emptyContainer: ViewStyle;
  modalTitle: TextStyle;
  modalDescription: TextStyle;
  modalInput: TextStyle;
  modalButtons: ViewStyle;
  modalButton: ViewStyle;
  modalButtonSecondary: ViewStyle;
  modalButtonPrimary: ViewStyle;
  webOnlyMessage: ViewStyle;
  webOnlyText: TextStyle;
}>({
  container: { flex: 1 },
  loadingContainer: { justifyContent: 'center', alignItems: 'center' },
  content: { padding: 12, paddingBottom: 40, alignItems: 'center' },
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
  modalScrollView: {
    maxHeight: Platform.OS === 'web' ? 400 : 400,
  },
  modalGridContent: {
    paddingVertical: 16,
    paddingBottom: 32,
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    gap: Platform.OS === 'web' ? 12 : 8,
  },
  iconItem: { 
    width: Platform.OS === 'web' ? 110 : Math.floor((width - 100) / 3),
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  iconItemBox: {
    width: Platform.OS === 'web' ? 90 : Math.min(90, Math.floor((width - 120) / 3)),
    height: Platform.OS === 'web' ? 90 : Math.min(90, Math.floor((width - 120) / 3)),
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: '#e5e5e5',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  selectedIconBox: {
    borderWidth: 3,
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
    transform: [{ scale: 1.05 }],
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    paddingHorizontal: 16,
    gap: Platform.OS === 'web' ? 16 : 14,
  },
  colorItem: { 
    width: Platform.OS === 'web' ? 70 : 70,
    height: Platform.OS === 'web' ? 70 : 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#ddd',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
    marginBottom: Platform.OS === 'web' ? 0 : 8,
  },
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