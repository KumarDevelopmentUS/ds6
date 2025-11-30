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
  badge?: number;
}

export const MenuCard: React.FC<MenuCardProps> = ({ 
  title, 
  icon, 
  color, 
  onPress,
  badge 
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
        {badge !== undefined && badge > 0 && (
          <View style={[styles.badge, { backgroundColor: theme.colors.error }]}>
            <ThemedText style={styles.badgeText}>
              {badge > 99 ? '99+' : badge}
            </ThemedText>
          </View>
        )}
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
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  title: {
    textAlign: 'center',
    fontWeight: '600',
  },
});
