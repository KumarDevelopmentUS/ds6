// app/(auth)/signUp.tsx
import { HapticBackButton } from '@/components/HapticBackButton';
import { SCHOOLS, searchSchools } from '@/constants/schools';
import { supabase } from '@/supabase';
import { sendMagicLinkSignup } from '@/utils/magicLinkAuth';
import { ensureUserProfilesExist, joinDefaultCommunity } from '@/utils/profileSync';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
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
  const [emailLinkLoading, setEmailLinkLoading] = useState(false);
  const [showSchoolPicker, setShowSchoolPicker] = useState(false);
  const [schoolSearch, setSchoolSearch] = useState('');
  const [filteredSchools, setFilteredSchools] = useState(SCHOOLS);
  const [showEmailLink, setShowEmailLink] = useState(true);
  const [emailLinkSent, setEmailLinkSent] = useState(false);
  const [cooldownTimer, setCooldownTimer] = useState(0);
  const [errors, setErrors] = useState({
    username: '',
    nickname: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameCheckTimeout, setUsernameCheckTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (usernameCheckTimeout) {
        clearTimeout(usernameCheckTimeout);
      }
    };
  }, [usernameCheckTimeout]);

  // Cooldown timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (cooldownTimer > 0) {
      interval = setInterval(() => {
        setCooldownTimer((prev) => {
          if (prev <= 1) {
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [cooldownTimer]);

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

  const validateUsername = (username: string) => {
    if (username.length > 0 && username.length < 5) {
      return 'Username must be at least 5 characters long';
    }
    if (username.length > 0 && !/^[a-zA-Z0-9._]+$/.test(username)) {
      return 'Username can only contain letters, numbers, dots (.), and underscores (_)';
    }
    return '';
  };

  const validateNickname = (nickname: string) => {
    if (nickname.length > 0 && !/^[a-zA-Z0-9._]+$/.test(nickname)) {
      return 'Nickname can only contain letters, numbers, dots (.), and underscores (_)';
    }
    return '';
  };

  const validateEmail = (email: string) => {
    if (email.length > 0) {
      const lowerEmail = email.toLowerCase();
      if (lowerEmail.endsWith('.edu')) {
        return 'Educational (.edu) email addresses are not permitted';
      }
      if (lowerEmail.endsWith('.gov')) {
        return 'Government (.gov) email addresses are not permitted';
      }
      if (lowerEmail.endsWith('.mil')) {
        return 'Military (.mil) email addresses are not permitted';
      }
      if (lowerEmail.endsWith('.int')) {
        return 'International organization (.int) email addresses are not permitted';
      }
    }
    return '';
  };

  const validatePassword = (password: string) => {
    if (password.length > 0 && password.length < 6) {
      return 'Password must be at least 6 characters long';
    }
    return '';
  };

  // Check if username is already taken
  const checkUsernameAvailability = async (username: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('username', username.toLowerCase())
        .single();

      if (error && error.code === 'PGRST116') {
        // No user found with this username, so it's available
        return true;
      }

      if (data) {
        // Username is already taken
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error checking username availability:', error);
      // If there's an error checking, assume username is taken to be safe
      return false;
    }
  };

  const validateConfirmPassword = (password: string, confirmPassword: string) => {
    if (confirmPassword.length > 0 && password !== confirmPassword) {
      return 'Passwords do not match';
    }
    return '';
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value });
    
    // Real-time validation
    let error = '';
    switch (field) {
      case 'username':
        error = validateUsername(value);
        // Check username availability when username field changes
        if (value.length >= 5) {
          handleUsernameCheck(value);
        } else {
          setUsernameAvailable(null);
        }
        break;
      case 'nickname':
        error = validateNickname(value);
        break;
      case 'email':
        error = validateEmail(value);
        break;
      case 'password':
        error = validatePassword(value);
        // Also validate confirm password if it exists
        if (formData.confirmPassword) {
          setErrors(prev => ({ 
            ...prev, 
            confirmPassword: validateConfirmPassword(value, formData.confirmPassword) 
          }));
        }
        break;
      case 'confirmPassword':
        error = validateConfirmPassword(formData.password, value);
        break;
    }
    
    setErrors(prev => ({ ...prev, [field]: error }));
  };

  const handleUsernameCheck = async (username: string) => {
    if (username.length < 5) return;
    
    // Clear any existing timeout
    if (usernameCheckTimeout) {
      clearTimeout(usernameCheckTimeout);
    }
    
    // Set a new timeout for debounced username check
    const timeoutId = setTimeout(async () => {
      setCheckingUsername(true);
      const isAvailable = await checkUsernameAvailability(username);
      setUsernameAvailable(isAvailable);
      setCheckingUsername(false);
    }, 500); // 500ms delay
    
    setUsernameCheckTimeout(timeoutId);
  };

  const handleSignUp = async () => {
    const { username, email, password, confirmPassword, nickname, school } = formData;

    if (!username || !email || !password || !confirmPassword || !nickname) {
      Alert.alert('Missing Information', 'Please fill in all required fields.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Password Mismatch', 'Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Weak Password', 'Password must be at least 6 characters long.');
      return;
    }

    if (username.length < 5) {
      Alert.alert('Username Too Short', 'Username must be at least 5 characters long.');
      return;
    }

    if (!/^[a-zA-Z0-9._]+$/.test(username)) {
      Alert.alert('Invalid Username', 'Username can only contain letters, numbers, dots (.), and underscores (_).');
      return;
    }

    if (!/^[a-zA-Z0-9._]+$/.test(nickname)) {
      Alert.alert('Invalid Nickname', 'Nickname can only contain letters, numbers, dots (.), and underscores (_).');
      return;
    }

    // Check if username is available
    if (usernameAvailable === false) {
      Alert.alert('Username Taken', 'This username is already taken. Please choose a different username.');
      return;
    }

    // If username availability hasn't been checked yet, check it now
    if (usernameAvailable === null) {
      setLoading(true);
      const isAvailable = await checkUsernameAvailability(username);
      setLoading(false);
      
      if (!isAvailable) {
        Alert.alert('Username Taken', 'This username is already taken. Please choose a different username.');
        return;
      }
    }

    const lowerEmail = email.toLowerCase();
    if (lowerEmail.endsWith('.edu')) {
      Alert.alert('Email Not Allowed', 'Educational (.edu) email addresses are not permitted for registration.');
      return;
    }
    if (lowerEmail.endsWith('.gov')) {
      Alert.alert('Email Not Allowed', 'Government (.gov) email addresses are not permitted for registration.');
      return;
    }
    if (lowerEmail.endsWith('.mil')) {
      Alert.alert('Email Not Allowed', 'Military (.mil) email addresses are not permitted for registration.');
      return;
    }
    if (lowerEmail.endsWith('.int')) {
      Alert.alert('Email Not Allowed', 'International organization (.int) email addresses are not permitted for registration.');
      return;
    }

    setLoading(true);

    try {
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

      const { data: authData, error: authError } = await supabase.auth.signUp(signUpPayload);

      if (authError) {
        if (authError.message.includes('User already registered')) {
          Alert.alert('Account Exists', 'An account with this email already exists. Please sign in instead.');
        } else {
          Alert.alert('Sign Up Error', authError.message);
        }
        return;
      }

      if (!authData.user) {
        Alert.alert('Error', 'Failed to create user account.');
        return;
      }

      // Step 2: Ensure both profile tables are created
      await ensureUserProfilesExist(authData.user.id, {
        username: username.toLowerCase(),
        nickname: nickname,
        school: school,
      });

      // Step 3: Add user to default community
      await joinDefaultCommunity(authData.user.id);

      // Step 4: Success!
      if (authData.session) {
        Alert.alert('Success', 'Account created successfully!');
        router.replace('/(tabs)/' as any);
      } else {
        Alert.alert('Check Your Email', 'Please verify your email to continue.');
        router.replace('/(auth)/login');
      }

    } catch (error: any) {
      console.error('Unexpected error during signup:', error);
      Alert.alert('Error', 'An unexpected error occurred during sign up.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLinkSignup = async () => {
    const { email, username, nickname, school } = formData;

    if (!email || !username || !nickname) {
      Alert.alert('Missing Information', 'Please fill in email, username, and nickname for email link signup.');
      return;
    }

    if (username.length < 5) {
      Alert.alert('Username Too Short', 'Username must be at least 5 characters long.');
      return;
    }

    if (!/^[a-zA-Z0-9._]+$/.test(username)) {
      Alert.alert('Invalid Username', 'Username can only contain letters, numbers, dots (.), and underscores (_).');
      return;
    }

    if (!/^[a-zA-Z0-9._]+$/.test(nickname)) {
      Alert.alert('Invalid Nickname', 'Nickname can only contain letters, numbers, dots (.), and underscores (_).');
      return;
    }

    // Check if username is available
    if (usernameAvailable === false) {
      Alert.alert('Username Taken', 'This username is already taken. Please choose a different username.');
      return;
    }

    // If username availability hasn't been checked yet, check it now
    if (usernameAvailable === null) {
      setMagicLinkLoading(true);
      const isAvailable = await checkUsernameAvailability(username);
      setMagicLinkLoading(false);
      
      if (!isAvailable) {
        Alert.alert('Username Taken', 'This username is already taken. Please choose a different username.');
        return;
      }
    }

    const lowerEmail = email.toLowerCase();
    if (lowerEmail.endsWith('.edu') || lowerEmail.endsWith('.gov') || lowerEmail.endsWith('.mil') || lowerEmail.endsWith('.int')) {
      Alert.alert('Email Not Allowed', 'Educational, government, military, or international organization email addresses are not permitted for registration.');
      return;
    }

    // Check cooldown timer
    if (cooldownTimer > 0) {
      Alert.alert('Please Wait', `Please wait ${cooldownTimer} seconds before sending another email link`);
      return;
    }

    setEmailLinkLoading(true);
    
    try {
      const result = await sendMagicLinkSignup(email);
      
      if (result.success) {
        setEmailLinkSent(true);
        setCooldownTimer(15); // Start 15-second cooldown
        // Don't show alert, let the UI show the success message
      } else {
        Alert.alert('Error', result.message);
        setEmailLinkSent(false);
      }
    } catch (error: any) {
      Alert.alert('Error', 'Failed to send email link. Please try again.');
    } finally {
      setEmailLinkLoading(false);
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
        <HapticBackButton
          onPress={handleBack}
          style={styles.backButton}
          color="#3b82f6"
        />

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
            <View style={{ marginBottom: 20 }}>
              <ThemedInput
                placeholder="First Name"
                value={formData.nickname}
                onChangeText={(text) => handleInputChange('nickname', text)}
                icon={<Ionicons name="person-outline" size={24} color={theme.colors.textSecondary} />}
                style={{ marginBottom: errors.nickname ? 5 : 0 }}
              />
              {errors.nickname ? (
                <ThemedText variant="caption" style={[styles.errorText, { color: theme.colors.error }]}>
                  {errors.nickname}
                </ThemedText>
              ) : null}
            </View>
            <View style={{ marginBottom: 20 }}>
              <ThemedInput
                placeholder="Username"
                value={formData.username}
                onChangeText={(text) => handleInputChange('username', text)}
                autoCapitalize="none"
                icon={<Ionicons name="at" size={24} color={theme.colors.textSecondary} />}
                style={{ marginBottom: errors.username ? 5 : 0 }}
              />
              {errors.username ? (
                <ThemedText variant="caption" style={[styles.errorText, { color: theme.colors.error }]}>
                  {errors.username}
                </ThemedText>
              ) : null}
              {/* Username availability indicator */}
              {formData.username.length >= 5 && usernameAvailable !== null && (
                <View style={styles.usernameStatusContainer}>
                  {checkingUsername ? (
                    <View style={styles.usernameStatusRow}>
                      <Ionicons name="time-outline" size={16} color={theme.colors.textSecondary} />
                      <ThemedText variant="caption" style={[styles.usernameStatusText, { color: theme.colors.textSecondary }]}>
                        Checking username availability...
                      </ThemedText>
                    </View>
                  ) : usernameAvailable ? (
                    <View style={styles.usernameStatusRow}>
                      <Ionicons name="checkmark-circle" size={16} color={theme.colors.success} />
                      <ThemedText variant="caption" style={[styles.usernameStatusText, { color: theme.colors.success }]}>
                        Username available
                      </ThemedText>
                    </View>
                  ) : (
                    <View style={styles.usernameStatusRow}>
                      <Ionicons name="close-circle" size={16} color={theme.colors.error} />
                      <ThemedText variant="caption" style={[styles.usernameStatusText, { color: theme.colors.error }]}>
                        Username already taken
                      </ThemedText>
                    </View>
                  )}
                </View>
              )}
            </View>
            <View style={{ marginBottom: 20 }}>
              <ThemedInput
                placeholder="Email"
                value={formData.email}
                onChangeText={(text) => handleInputChange('email', text)}
                keyboardType="email-address"
                autoCapitalize="none"
                icon={<Ionicons name="mail-outline" size={24} color={theme.colors.textSecondary} />}
                style={{ marginBottom: errors.email ? 5 : 0 }}
              />
              {errors.email ? (
                <ThemedText variant="caption" style={[styles.errorText, { color: theme.colors.error }]}>
                  {errors.email}
                </ThemedText>
              ) : null}
            </View>
            {!showEmailLink && (
              <>
                <View style={{ marginBottom: 20 }}>
                  <ThemedInput
                    placeholder="Password"
                    value={formData.password}
                    onChangeText={(text) => handleInputChange('password', text)}
                    secureTextEntry
                    icon={<Ionicons name="lock-closed-outline" size={24} color={theme.colors.textSecondary} />}
                    style={{ marginBottom: errors.password ? 5 : 0 }}
                  />
                  {errors.password ? (
                    <ThemedText variant="caption" style={[styles.errorText, { color: theme.colors.error }]}>
                      {errors.password}
                    </ThemedText>
                  ) : null}
                </View>
                <View style={{ marginBottom: 20 }}>
                  <ThemedInput
                    placeholder="Confirm Password"
                    value={formData.confirmPassword}
                    onChangeText={(text) => handleInputChange('confirmPassword', text)}
                    secureTextEntry
                    icon={<Ionicons name="lock-closed-outline" size={24} color={theme.colors.textSecondary} />}
                    style={{ marginBottom: errors.confirmPassword ? 5 : 0 }}
                  />
                  {errors.confirmPassword ? (
                    <ThemedText variant="caption" style={[styles.errorText, { color: theme.colors.error }]}>
                      {errors.confirmPassword}
                    </ThemedText>
                  ) : null}
                </View>
              </>
            )}

            {/* Success Display */}
            {emailLinkSent && (
              <View style={[styles.successContainer, { backgroundColor: theme.colors.success + '20', borderColor: theme.colors.success }]}>
                <Ionicons name="checkmark-circle" size={16} color={theme.colors.success} />
                <View style={styles.successTextContainer}>
                  <ThemedText variant="caption" style={[styles.successText, { color: theme.colors.success }]}>
                    Email link sent successfully!
                  </ThemedText>
                  <ThemedText variant="caption" style={[styles.successSubtext, { color: theme.colors.textSecondary }]}>
                    Check your email and click the link to complete registration. <ThemedText variant="caption" style={[styles.successSubtext, { color: theme.colors.textSecondary, fontWeight: 'bold' }]}>It may take up to a minute to receive the email.</ThemedText>
                  </ThemedText>
                </View>
              </View>
            )}

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

            {showEmailLink ? (
              <ThemedButton
                title={cooldownTimer > 0 ? `Resend in ${cooldownTimer}s` : "Send Email Link"}
                onPress={handleEmailLinkSignup}
                loading={emailLinkLoading}
                disabled={usernameAvailable === false || checkingUsername || cooldownTimer > 0}
                style={{ marginTop: theme.spacing.lg }}
              />
            ) : (
              <ThemedButton
                title="Create Account"
                onPress={handleSignUp}
                loading={loading}
                disabled={usernameAvailable === false || checkingUsername}
                style={{ marginTop: theme.spacing.lg }}
              />
            )}

            
            {/* Helpful message when username is taken */}
            {usernameAvailable === false && (
              <ThemedText 
                variant="caption" 
                style={[styles.helpText, { color: theme.colors.textSecondary, textAlign: 'center', marginTop: 10 }]}
              >
                Please choose a different username to continue
              </ThemedText>
            )}
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
            onPress={() => router.replace('/(tabs)/' as any)}
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
  errorText: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 5,
  },
  usernameStatusContainer: {
    marginTop: 5,
  },
  usernameStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  usernameStatusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  helpText: {
    fontSize: 12,
    fontWeight: '400',
  },
  successContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  successTextContainer: {
    flex: 1,
  },
  successText: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  successSubtext: {
    fontSize: 11,
    fontWeight: '400',
    lineHeight: 16,
  },
  authToggleContainer: {
    alignItems: 'center',
  },
});