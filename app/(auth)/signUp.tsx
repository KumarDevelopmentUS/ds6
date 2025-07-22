// app/(auth)/signUp.tsx
import { SCHOOLS, searchSchools } from '@/constants/schools';
import { supabase } from '@/supabase';
import { ensureUserProfilesExist, joinDefaultCommunity } from '@/utils/profileSync';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    Alert,
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
import { ThemedButton } from '../../components/themed/ThemedButton';
import { ThemedInput } from '../../components/themed/ThemedInput';
import { ThemedText } from '../../components/themed/ThemedText';
import { ThemedView } from '../../components/themed/ThemedView';
import { useTheme } from '../../contexts/ThemeContext';

export default function SignUpScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const [formData, setFormData] = useState({
    username: '', // Changed from firstName
    email: '',
    password: '',
    confirmPassword: '',
    nickname: '',
    school: '',
    schoolName: '',
  });
  const [loading, setLoading] = useState(false);
  const [showSchoolPicker, setShowSchoolPicker] = useState(false);
  const [schoolSearch, setSchoolSearch] = useState('');
  const [filteredSchools, setFilteredSchools] = useState(SCHOOLS);

  const handleSchoolSearch = (text: string) => {
    setSchoolSearch(text);
    const filtered = searchSchools(text);
    setFilteredSchools(filtered);
  };

  const selectSchool = (school: { name: string; value: string }) => {
    setFormData({ ...formData, school: school.value, schoolName: school.name });
    setShowSchoolPicker(false);
    setSchoolSearch('');
  };

  const handleSignUp = async () => {
    const { username, email, password, confirmPassword, nickname, school } = formData;

    console.log('🚀 SIGNUP DEBUG: Starting signup with data:', {
      username: username || 'MISSING',
      email: email || 'MISSING', 
      password: password ? `PROVIDED (${password.length} chars)` : 'MISSING',
      confirmPassword: confirmPassword ? 'PROVIDED' : 'MISSING',
      nickname: nickname || 'MISSING',
      school: school || 'NOT_PROVIDED'
    });

    if (!username || !email || !password || !confirmPassword || !nickname) {
      console.log('❌ SIGNUP DEBUG: Validation failed - missing required fields');
      Alert.alert('Missing Information', 'Please fill in all required fields.');
      return;
    }

    if (password !== confirmPassword) {
      console.log('❌ SIGNUP DEBUG: Validation failed - passwords do not match');
      Alert.alert('Password Mismatch', 'Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      console.log('❌ SIGNUP DEBUG: Validation failed - password too short');
      Alert.alert('Weak Password', 'Password must be at least 6 characters long.');
      return;
    }

    console.log('✅ SIGNUP DEBUG: All validations passed, starting signup...');
    setLoading(true);

    try {
      console.log('🔄 SIGNUP DEBUG: Step 1 - Calling supabase.auth.signUp...');
      
      // Step 1: Create auth user
      const signUpPayload = {
        email,
        password,
        options: {
          data: {
            username: username.toLowerCase(),
            nickname: nickname,
            ...(school && { school }),
          },
        },
      };
      
      console.log('📤 SIGNUP DEBUG: Auth payload:', {
        email: signUpPayload.email,
        hasPassword: !!signUpPayload.password,
        metadata: signUpPayload.options.data
      });

      const { data: authData, error: authError } = await supabase.auth.signUp(signUpPayload);

      console.log('📥 SIGNUP DEBUG: Auth response:', {
        hasData: !!authData,
        hasUser: !!authData?.user,
        userId: authData?.user?.id,
        userEmail: authData?.user?.email,
        hasSession: !!authData?.session,
        hasError: !!authError,
        errorMessage: authError?.message,
        errorCode: authError?.status
      });

      if (authError) {
        console.error('❌ SIGNUP DEBUG: Auth signup failed with error:', authError);
        if (authError.message.includes('User already registered')) {
          Alert.alert('Account Exists', 'An account with this email already exists. Please sign in instead.');
        } else {
          Alert.alert('Sign Up Error', authError.message);
        }
        return;
      }

      if (!authData.user) {
        console.error('❌ SIGNUP DEBUG: No user returned from auth signup');
        Alert.alert('Error', 'Failed to create user account.');
        return;
      }

      console.log('✅ SIGNUP DEBUG: Auth user created successfully:', {
        userId: authData.user.id,
        email: authData.user.email,
        emailConfirmed: authData.user.email_confirmed_at,
        userMetadata: authData.user.user_metadata
      });

      // Step 2: Ensure both profile tables are created
      console.log('🔄 SIGNUP DEBUG: Step 2 - Creating profile records...');
      const profileResult = await ensureUserProfilesExist(authData.user.id, {
        username: username.toLowerCase(),
        nickname: nickname,
        school: school,
      });
      console.log('📋 SIGNUP DEBUG: Profile creation result:', profileResult);

      // Step 3: Add user to default community
      console.log('🔄 SIGNUP DEBUG: Step 3 - Joining default community...');
      const communityResult = await joinDefaultCommunity(authData.user.id);
      console.log('🏘️ SIGNUP DEBUG: Community join result:', communityResult);

      // Step 4: Success!
      console.log('🔄 SIGNUP DEBUG: Step 4 - Final success handling...');
      if (authData.session) {
        console.log('✅ SIGNUP DEBUG: User has session, redirecting to home');
        Alert.alert('Success', 'Account created successfully!');
        router.replace('/(tabs)/home');
      } else {
        console.log('📧 SIGNUP DEBUG: No session, user needs email verification');
        Alert.alert('Check Your Email', 'Please verify your email to continue.');
        router.replace('/(auth)/login');
      }

      console.log('🎉 SIGNUP DEBUG: Signup process completed successfully');

    } catch (error: any) {
      console.error('💥 SIGNUP DEBUG: Unexpected error during signup:', {
        error: error,
        message: error?.message,
        stack: error?.stack
      });
      Alert.alert('Error', 'An unexpected error occurred during sign up.');
    } finally {
      console.log('🔚 SIGNUP DEBUG: Cleanup - setting loading to false');
      setLoading(false);
    }
  };

  const handleBack = () => {
    router.back();
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Back Button */}
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#3b82f6" />
          <ThemedText style={styles.backText}>Back</ThemedText>
        </TouchableOpacity>

        <ThemedView style={styles.content}>
          {/* Header */}
          <View style={[styles.logoContainer, { backgroundColor: theme.colors.primary }]}>
            <Ionicons name="person-add" size={60} color="#FFFFFF" />
          </View>

          <ThemedText variant="title" style={styles.title}>
            Create Account
          </ThemedText>
          <ThemedText variant="body" style={styles.subtitle}>
            Join the dice tracking community
          </ThemedText>

          {/* Form */}
          <ThemedView variant="card" style={styles.formCard}>
            <ThemedInput
              placeholder="First Name"
              value={formData.nickname}
              onChangeText={(text) => setFormData({ ...formData, nickname: text })}
              icon={<Ionicons name="person-outline" size={24} color={theme.colors.textSecondary} />}
              style={{ marginBottom: 20 }}
            />
            <ThemedInput
              placeholder="Username"
              value={formData.username}
              onChangeText={(text) => setFormData({ ...formData, username: text })}
              autoCapitalize="none"
              icon={<Ionicons name="at" size={24} color={theme.colors.textSecondary} />}
              style={{ marginBottom: 20 }}
            />
            <ThemedInput
              placeholder="Email"
              value={formData.email}
              onChangeText={(text) => setFormData({ ...formData, email: text })}
              keyboardType="email-address"
              autoCapitalize="none"
              icon={<Ionicons name="mail-outline" size={24} color={theme.colors.textSecondary} />}
              style={{ marginBottom: 20 }}
            />
            <ThemedInput
              placeholder="Password"
              value={formData.password}
              onChangeText={(text) => setFormData({ ...formData, password: text })}
              secureTextEntry
              icon={<Ionicons name="lock-closed-outline" size={24} color={theme.colors.textSecondary} />}
              style={{ marginBottom: 20 }}
            />
            <ThemedInput
              placeholder="Confirm Password"
              value={formData.confirmPassword}
              onChangeText={(text) => setFormData({ ...formData, confirmPassword: text })}
              secureTextEntry
              icon={<Ionicons name="lock-closed-outline" size={24} color={theme.colors.textSecondary} />}
              style={{ marginBottom: 20 }}
            />

            {/* School Selector */}
            <TouchableOpacity
              style={[styles.schoolSelector, {
                backgroundColor: theme.colors.inputBackground,
                borderColor: theme.colors.border,
                marginTop: theme.spacing.md
              }]}
              onPress={() => setShowSchoolPicker(true)}
            >
              <Ionicons name="school-outline" size={20} color={theme.colors.textSecondary} />
              <ThemedText style={styles.schoolText}>
                {formData.schoolName || 'Select School (Optional)'}
              </ThemedText>
              <Ionicons name="chevron-down" size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>

            <ThemedButton
              title="Create Account"
              onPress={handleSignUp}
              loading={loading}
              style={{ marginTop: theme.spacing.lg }}
            />
          </ThemedView>

          <ThemedButton
            title="Already have an account? Sign In"
            variant="ghost"
            onPress={() => router.replace('/(auth)/login')}
            size="small"
            style={{ marginTop: theme.spacing.lg }}
          />

          <ThemedButton
            title="Go to Home"
            variant="ghost"
            onPress={() => router.replace('/(tabs)/home')}
            size="small"
            style={{ marginTop: theme.spacing.sm }}
          />
        </ThemedView>
      </ScrollView>

      {/* School Picker Modal */}
      <Modal
        visible={showSchoolPicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowSchoolPicker(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
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
                <TextInput
                  style={[styles.searchInput, { color: theme.colors.text }]}
                  placeholder="Search schools..."
                  placeholderTextColor={theme.colors.textSecondary}
                  value={schoolSearch}
                  onChangeText={handleSchoolSearch}
                />
              </View>

              <FlatList
                data={filteredSchools}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.schoolItem, { borderBottomColor: theme.colors.border }]}
                    onPress={() => selectSchool(item)}
                  >
                    <ThemedText>{item.name}</ThemedText>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <ThemedText variant="caption">No schools found</ThemedText>
                  </View>
                }
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 20,
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  backText: {
    marginLeft: 8,
    color: '#3b82f6',
    fontSize: 16,
    fontWeight: '500',
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 32,
  },
  title: {
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 32,
  },
  formCard: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    padding: 20,
    borderRadius: 10,
  },
  schoolSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  schoolText: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 20,
    padding: 20,
    maxHeight: '80%',
    width: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  schoolItem: {
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
});