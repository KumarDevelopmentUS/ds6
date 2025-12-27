// app/components/themed/ThemedInput.tsx
import { Ionicons } from '@expo/vector-icons';
import React, { useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, Text, TextInput, TextInputProps, TouchableOpacity, View, ViewStyle } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

interface ThemedInputProps extends Omit<TextInputProps, 'style'> {
  icon?: React.ReactNode;
  style?: ViewStyle;
  containerStyle?: ViewStyle;
  label?: string;
  error?: string;
  success?: boolean;
  hint?: string;
  showClearButton?: boolean;
  onClear?: () => void;
  rightIcon?: React.ReactNode;
}

export const ThemedInput: React.FC<ThemedInputProps> = ({ 
  style, 
  containerStyle,
  icon,
  label,
  error,
  success,
  hint,
  showClearButton = false,
  onClear,
  rightIcon,
  value,
  onChangeText,
  onFocus,
  onBlur,
  ...props 
}) => {
  const { theme } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const focusAnim = useRef(new Animated.Value(0)).current;

  const handleFocus = (e: any) => {
    setIsFocused(true);
    Animated.timing(focusAnim, {
      toValue: 1,
      duration: 150,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
    onFocus?.(e);
  };

  const handleBlur = (e: any) => {
    setIsFocused(false);
    Animated.timing(focusAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
    onBlur?.(e);
  };

  const handleClear = () => {
    onChangeText?.('');
    onClear?.();
  };

  const getBorderColor = () => {
    if (error) return theme.colors.error;
    if (success) return theme.colors.success;
    if (isFocused) return theme.colors.inputFocused;
    return theme.colors.inputBorder;
  };

  const borderWidth = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 2],
  });

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label && (
        <Text style={[styles.label, { color: error ? theme.colors.error : theme.colors.text }]}>
          {label}
        </Text>
      )}
      <Animated.View 
        style={[
          styles.container, 
          { 
            backgroundColor: theme.colors.inputBackground,
            borderColor: getBorderColor(),
            borderWidth: Platform.OS === 'web' ? (error || success || isFocused ? 2 : 1) : 1,
          }, 
          style,
        ]}
      > 
      {icon && (
        <View style={styles.iconContainer}>{icon}</View>
      )}
      <TextInput
        style={[
          styles.input,
          { 
            color: theme.colors.text,
          }
        ]}
          placeholderTextColor={theme.colors.textTertiary}
          value={value}
          onChangeText={onChangeText}
          onFocus={handleFocus}
          onBlur={handleBlur}
        {...props}
      />
        {showClearButton && value && String(value).length > 0 && (
          <TouchableOpacity 
            onPress={handleClear} 
            style={styles.clearButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close-circle" size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        )}
        {success && !showClearButton && (
          <View style={styles.statusIcon}>
            <Ionicons name="checkmark-circle" size={20} color={theme.colors.success} />
          </View>
        )}
        {error && !showClearButton && (
          <View style={styles.statusIcon}>
            <Ionicons name="alert-circle" size={20} color={theme.colors.error} />
          </View>
        )}
        {rightIcon && (
          <View style={styles.rightIconContainer}>{rightIcon}</View>
        )}
      </Animated.View>
      {(error || hint) && (
        <View style={styles.helperContainer}>
          {error && (
            <Text style={[styles.errorText, { color: theme.colors.error }]}>
              {error}
            </Text>
          )}
          {!error && hint && (
            <Text style={[styles.hintText, { color: theme.colors.textSecondary }]}>
              {hint}
            </Text>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 6,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 16,
    height: 52,
    borderWidth: 1,
  },
  iconContainer: {
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
    width: 24,
    height: 24,
  },
  input: {
    flex: 1,
    fontSize: 16,
    height: '100%',
    paddingVertical: 0,
    textAlignVertical: 'center',
  },
  clearButton: {
    padding: 4,
    marginLeft: 8,
  },
  statusIcon: {
    marginLeft: 8,
  },
  rightIconContainer: {
    marginLeft: 8,
  },
  helperContainer: {
    marginTop: 6,
    paddingHorizontal: 4,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '400',
  },
  hintText: {
    fontSize: 13,
    fontWeight: '400',
  },
});