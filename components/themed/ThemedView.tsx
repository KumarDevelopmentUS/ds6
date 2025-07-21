// app/components/themed/ThemedView.tsx
import React from 'react';
import { View, ViewProps } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

interface ThemedViewProps extends ViewProps {
  variant?: 'default' | 'card' | 'section';
}

export const ThemedView: React.FC<ThemedViewProps> = ({ 
  style, 
  variant = 'default',
  ...props 
}) => {
  const { theme } = useTheme();
  
  const variantStyles = {
    default: {},
    card: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.md,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: theme.dark ? 0.3 : 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    section: {
      marginBottom: theme.spacing.lg,
    },
  };

  return (
    <View 
      style={[
        { backgroundColor: variant === 'default' ? theme.colors.background : undefined },
        variantStyles[variant],
        style
      ]} 
      {...props} 
    />
  );
};

export default ThemedView; // Make sure your component is exported as default