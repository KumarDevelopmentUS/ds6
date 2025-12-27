// app/components/themed/ThemedButton.tsx
import * as Haptics from 'expo-haptics';
import * as React from 'react';
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  PressableProps,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { ThemedText } from './ThemedText';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
type ButtonSize = 'small' | 'medium' | 'large';

interface ThemedButtonProps extends Omit<PressableProps, 'style'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  loadingText?: string;
  title: string;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  hapticFeedback?: boolean;
  style?: ViewStyle;
}

export const ThemedButton: React.FC<ThemedButtonProps> = ({ 
  style, 
  variant = 'primary',
  size = 'medium',
  loading = false,
  loadingText,
  title,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  hapticFeedback = true,
  disabled,
  onPress,
  ...props 
}) => {
  const { theme } = useTheme();
  const scaleAnim = React.useRef(new Animated.Value(1)).current;
  
  const handlePressIn = () => {
    Animated.timing(scaleAnim, {
      toValue: 0.97,
      duration: 100,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  };

  const handlePressOut = () => {
    Animated.timing(scaleAnim, {
      toValue: 1,
      duration: 100,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  };

  const handlePress = (e: any) => {
    if (hapticFeedback && Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress?.(e);
  };

  const sizeStyles: Record<ButtonSize, ViewStyle> = {
    small: {
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      minHeight: theme.touchTargets.minimum,
    },
    medium: {
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      minHeight: theme.touchTargets.comfortable,
    },
    large: {
      paddingVertical: theme.spacing.md + 4,
      paddingHorizontal: theme.spacing.xl,
      minHeight: theme.touchTargets.generous,
    },
  };

  const getVariantStyles = (): { bg: string; text: string; border?: string } => {
    switch (variant) {
      case 'primary':
        return { bg: theme.colors.buttonPrimary, text: '#FFFFFF' };
      case 'secondary':
        return { bg: theme.colors.buttonSecondary, text: theme.colors.text };
      case 'outline':
        return { bg: 'transparent', text: theme.colors.primary, border: theme.colors.primary };
      case 'ghost':
        return { bg: 'transparent', text: theme.colors.primary };
      case 'danger':
        return { bg: theme.colors.error, text: '#FFFFFF' };
      case 'success':
        return { bg: theme.colors.success, text: '#FFFFFF' };
      default:
        return { bg: theme.colors.buttonPrimary, text: '#FFFFFF' };
    }
  };

  const variantStyle = getVariantStyles();
  const isDisabled = disabled || loading;

  const textSize = {
    small: 14,
    medium: 16,
    large: 17,
  }[size];

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }], width: fullWidth ? '100%' : undefined }}>
      <Pressable
        style={({ pressed }) => [
        styles.button,
        sizeStyles[size],
        { 
            backgroundColor: variantStyle.bg,
            borderColor: variantStyle.border,
            borderWidth: variant === 'outline' ? 2 : 0,
          borderRadius: theme.borderRadius.md,
            opacity: isDisabled ? 0.5 : pressed ? 0.9 : 1,
            width: fullWidth ? '100%' : undefined,
        },
          Platform.OS === 'web' && !isDisabled && styles.webHover,
          style,
      ]}
        disabled={isDisabled}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityState={{ disabled: isDisabled, busy: loading }}
      {...props}
    >
      <View style={styles.content}>
        {loading ? (
            <>
          <ActivityIndicator 
                color={variantStyle.text} 
                size="small"
              />
              {loadingText && (
                <ThemedText 
                  variant="button" 
                  style={{ color: variantStyle.text, marginLeft: 8, fontSize: textSize }}
                >
                  {loadingText}
                </ThemedText>
              )}
            </>
        ) : (
          <>
              {icon && iconPosition === 'left' && <View style={styles.iconLeft}>{icon}</View>}
            <ThemedText 
              variant="button" 
                style={{ color: variantStyle.text, fontSize: textSize, fontWeight: '600' }}
            >
              {title}
            </ThemedText>
              {icon && iconPosition === 'right' && <View style={styles.iconRight}>{icon}</View>}
          </>
        )}
      </View>
      </Pressable>
    </Animated.View>
  );
};

export default ThemedButton;

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconLeft: {
    marginRight: 8,
  },
  iconRight: {
    marginLeft: 8,
  },
  webHover: Platform.select({
    web: {
      cursor: 'pointer',
      // @ts-ignore - web only
      transition: 'transform 0.1s ease, opacity 0.1s ease',
    },
    default: {},
  }),
});