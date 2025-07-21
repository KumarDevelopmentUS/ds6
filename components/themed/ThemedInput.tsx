// app/components/themed/ThemedInput.tsx
import React from 'react';
import { StyleSheet, TextInput, TextInputProps, View } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

interface ThemedInputProps extends TextInputProps {
  icon?: React.ReactNode;
}

export const ThemedInput: React.FC<ThemedInputProps> = ({ 
  style, 
  icon,
  ...props 
}) => {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.inputBackground }]}>
      {icon && <View style={styles.icon}>{icon}</View>}
      <TextInput
        style={[
          styles.input,
          { 
            color: theme.colors.text,
            flex: 1,
          },
          style
        ]}
        placeholderTextColor={theme.colors.textSecondary}
        {...props}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 16,
    height: 50,
  },
  icon: {
    marginRight: 12,
  },
  input: {
    fontSize: 16,
    height: '100%',
  },
});