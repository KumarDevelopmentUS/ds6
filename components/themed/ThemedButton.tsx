// app/components/themed/ThemedButton.tsx
import * as React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  TouchableOpacityProps,
  View
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { ThemedText } from './ThemedText';

interface ThemedButtonProps extends TouchableOpacityProps {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'small' | 'medium' | 'large';
  loading?: boolean;
  title: string;
  icon?: React.ReactNode;
}

export const ThemedButton: React.FC<ThemedButtonProps> = ({ 
  style, 
  variant = 'primary',
  size = 'medium',
  loading = false,
  title,
  icon,
  disabled,
  ...props 
}) => {
  const { theme } = useTheme();
  
  const sizeStyles = {
    small: {
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
    },
    medium: {
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
    },
    large: {
      paddingVertical: theme.spacing.md + 4,
      paddingHorizontal: theme.spacing.xl,
    },
  };

  const variantStyles = {
    primary: {
      backgroundColor: theme.colors.buttonPrimary,
      borderWidth: 0,
    },
    secondary: {
      backgroundColor: theme.colors.buttonSecondary,
      borderWidth: 0,
    },
    outline: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    ghost: {
      backgroundColor: 'transparent',
      borderWidth: 0,
    },
  };

  const textColor = variant === 'primary' ? '#FFFFFF' : 
                   variant === 'secondary' ? theme.colors.text :
                   theme.colors.primary;

  return (
    <TouchableOpacity
      style={[
        styles.button,
        sizeStyles[size],
        variantStyles[variant],
        { 
          borderRadius: theme.borderRadius.md,
          opacity: disabled || loading ? 0.6 : 1,
        },
        style
      ]}
      disabled={disabled || loading}
      {...props}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator 
            color={textColor} 
            size={size === 'small' ? 'small' : 'small'}
          />
        ) : (
          <>
            {icon && <View style={styles.icon}>{icon}</View>}
            <ThemedText 
              variant="button" 
              style={{ color: textColor }}
            >
              {title}
            </ThemedText>
          </>
        )}
      </View>
    </TouchableOpacity>
  );
};

export default ThemedButton; // Make sure your component is exported as default


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
  icon: {
    marginRight: 8,
  },
});