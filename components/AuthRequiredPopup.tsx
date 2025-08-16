import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
    Alert,
    Modal,
    Platform,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';
import { ThemedText } from './themed/ThemedText';
import { ThemedView } from './themed/ThemedView';

interface AuthRequiredPopupProps {
  visible: boolean;
  onDismiss: () => void;
  onSignIn: () => void;
  title?: string;
  message?: string;
}

export function AuthRequiredPopup({
  visible,
  onDismiss,
  onSignIn,
  title = 'Sign In Required',
  message = 'You must be logged in to access this feature.',
}: AuthRequiredPopupProps) {
  const { theme } = useTheme();

  // For iOS, use Alert instead of Modal for better native feel
  const handleIOSAuthRequired = React.useCallback(() => {
    Alert.alert(
      title,
      message,
      [
        { text: 'Dismiss', style: 'cancel' },
        { text: 'Sign In', onPress: onSignIn },
      ]
    );
  }, [title, message, onSignIn]);

  // Show iOS Alert when component becomes visible
  React.useEffect(() => {
    if (visible && Platform.OS === 'ios') {
      handleIOSAuthRequired();
      onDismiss(); // Close the modal after showing Alert
    }
  }, [visible, onDismiss, handleIOSAuthRequired]);

  // For web, show the modal
  if (Platform.OS === 'ios') {
    return null; // iOS uses Alert, so no modal needed
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        <ThemedView variant="card" style={styles.popup}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Ionicons name="lock-closed" size={32} color={theme.colors.primary} />
            </View>
            <ThemedText variant="title" style={styles.title}>
              {title}
            </ThemedText>
            <ThemedText variant="body" style={styles.message}>
              {message}
            </ThemedText>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, styles.dismissButton]}
              onPress={onDismiss}
            >
              <ThemedText variant="body" style={styles.dismissButtonText}>
                Dismiss
              </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.signInButton]}
              onPress={onSignIn}
            >
              <ThemedText variant="body" style={styles.signInButtonText}>
                Sign In
              </ThemedText>
            </TouchableOpacity>
          </View>
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  popup: {
    width: '100%',
    maxWidth: 400,
    padding: 24,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    textAlign: 'center',
    color: '#6b7280',
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissButton: {
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  dismissButtonText: {
    color: '#374151',
    fontWeight: '600',
  },
  signInButton: {
    backgroundColor: '#007AFF',
  },
  signInButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
});
