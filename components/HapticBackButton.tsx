import { ThemedText } from '@/components/themed/ThemedText';
import { useTheme } from '@/contexts/ThemeContext';
import { useHaptics } from '@/contexts/HapticsContext';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';

interface HapticBackButtonProps {
  onPress: () => void;
  text?: string;
  color?: string;
  style?: any;
  iconSize?: number;
}

export function HapticBackButton({ 
  onPress, 
  text = 'Back', 
  color, 
  style,
  iconSize = 24 
}: HapticBackButtonProps) {
  const { theme } = useTheme();
  const { vibrationEnabled } = useHaptics();
  const buttonColor = color || theme.colors.primary;

  const handlePress = () => {
    // Add haptic feedback on iOS if enabled
    if (process.env.EXPO_OS === 'ios' && vibrationEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  };

  return (
    <TouchableOpacity 
      onPress={handlePress} 
      style={[styles.backButton, style]}
    >
      <Ionicons name="arrow-back" size={iconSize} color={buttonColor} />
      <ThemedText style={[styles.backText, { color: buttonColor }]}>
        {text}
      </ThemedText>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  backText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '500',
  },
}); 