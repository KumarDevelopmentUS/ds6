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
    <View style={[styles.container, { backgroundColor: theme.colors.inputBackground }, style]}> 
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
    height: 56,
    marginBottom: 0,
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
});