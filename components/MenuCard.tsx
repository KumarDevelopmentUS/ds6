// app/components/MenuCard.tsx
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { ThemedText } from './themed/ThemedText';

interface MenuCardProps {
  title: string;
  icon: string;
  color: string;
  onPress: () => void;
}

export const MenuCard: React.FC<MenuCardProps> = ({ 
  title, 
  icon, 
  color, 
  onPress 
}) => {
  const { theme } = useTheme();

  return (
    <TouchableOpacity
      style={[
        styles.card,
        { 
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
        }
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.iconContainer, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon as any} size={32} color={color} />
      </View>
      <ThemedText variant="body" style={styles.title}>
        {title}
      </ThemedText>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: '48%',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    textAlign: 'center',
    fontWeight: '600',
  },
});