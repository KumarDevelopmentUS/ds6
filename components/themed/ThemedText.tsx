// app/components/themed/ThemedText.tsx
import React from 'react';
import { Text, TextProps } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

interface ThemedTextProps extends TextProps {
  variant?: 'default' | 'title' | 'subtitle' | 'body' | 'caption' | 'button';
  color?: 'primary' | 'error' | 'success' | 'warning';
}

export const ThemedText: React.FC<ThemedTextProps> = ({ 
  style, 
  variant = 'default',
  color,
  ...props 
}) => {
  const { theme } = useTheme();
  
  const variantStyles = {
    default: {
      fontSize: 16,
      color: theme.colors.text,
    },
    title: {
      fontSize: 32,
      fontWeight: 'bold' as const,
      color: theme.colors.text,
      marginBottom: theme.spacing.sm,
    },
    subtitle: {
      fontSize: 24,
      fontWeight: '600' as const,
      color: theme.colors.text,
      marginBottom: theme.spacing.sm,
    },
    body: {
      fontSize: 16,
      color: theme.colors.text,
      lineHeight: 24,
    },
    caption: {
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
    button: {
      fontSize: 18,
      fontWeight: '600' as const,
      color: theme.colors.text,
    },
  };

  const colorStyles = color ? {
    color: theme.colors[color] || theme.colors.text
  } : {};

  return (
    <Text 
      style={[
        variantStyles[variant],
        colorStyles,
        style
      ]} 
      {...props} 
    />
  );
};