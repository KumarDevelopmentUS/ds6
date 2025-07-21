// app/(auth)/signUp.tsx
import { supabase } from '@/supabase';
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
import { SCHOOLS, searchSchools } from '@/constants/schools';
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

    setLoading(true);

    try {
      // The trigger we created in the database will handle creating the profile.
      // If the username is not unique, the database will throw an error,
      // which will be caught here, ensuring data consistency.
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: username.toLowerCase(), // Store username in lowercase for consistency
            nickname: nickname,
            ...(school && { school }),
          },
        },
      });

      if (error) {
        // Provide a user-friendly message if the username is taken
        if (error.message.includes('violates unique constraint "user_profiles_username_key"')) {
            Alert.alert('Username Taken', 'This username is already in use. Please choose another.');
        } else {
            Alert.alert('Sign Up Error', error.message);
        }
      } else {
        if (data.user && data.session) {
          Alert.alert('Success', 'Account created successfully!');
          router.replace('/(tabs)/home');
        } else {
          Alert.alert('Check Your Email', 'Please verify your email to continue.');
          router.replace('/(auth)/login');
        }
      }
    } catch (err: any) {
      Alert.alert('Error', 'An unexpected error occurred during sign up.');
    } finally {
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
              placeholder="Username" // Changed from First Name
              value={formData.username}
              onChangeText={(text) => setFormData({ ...formData, username: text })}
              autoCapitalize="none"
              icon={<Ionicons name="person-circle-outline" size={20} color={theme.colors.textSecondary} />}
            />

            <ThemedInput
              placeholder="Email"
              value={formData.email}
              onChangeText={(text) => setFormData({ ...formData, email: text })}
              keyboardType="email-address"
              autoCapitalize="none"
              icon={<Ionicons name="mail-outline" size={20} color={theme.colors.textSecondary} />}
              style={{ marginTop: theme.spacing.md }}
            />

            <ThemedInput
              placeholder="Nickname"
              value={formData.nickname}
              onChangeText={(text) => setFormData({ ...formData, nickname: text })}
              icon={<Ionicons name="at" size={20} color={theme.colors.textSecondary} />}
              style={{ marginTop: theme.spacing.md }}
            />

            <ThemedInput
              placeholder="Password"
              value={formData.password}
              onChangeText={(text) => setFormData({ ...formData, password: text })}
              secureTextEntry
              icon={<Ionicons name="lock-closed-outline" size={20} color={theme.colors.textSecondary} />}
              style={{ marginTop: theme.spacing.md }}
            />

            <ThemedInput
              placeholder="Confirm Password"
              value={formData.confirmPassword}
              onChangeText={(text) => setFormData({ ...formData, confirmPassword: text })}
              secureTextEntry
              icon={<Ionicons name="lock-closed-outline" size={20} color={theme.colors.textSecondary} />}
              style={{ marginTop: theme.spacing.md }}
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