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
  const styles = createStyles(theme);

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

const createStyles = (theme: any) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
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
    backgroundColor: theme.colors.primary + '20',
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
    color: theme.colors.textSecondary,
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
    backgroundColor: theme.colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  dismissButtonText: {
    color: theme.colors.textPrimary,
    fontWeight: '600',
  },
  signInButton: {
    backgroundColor: theme.colors.primary,
  },
  signInButtonText: {
    color: theme.colors.textOnPrimary,
    fontWeight: '600',
  },
});
