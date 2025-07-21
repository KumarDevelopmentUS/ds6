// components/social/UserAvatar.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface UserAvatarProps {
  icon?: string;
  iconColor?: string;
  backgroundColor?: string;
  size?: number;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({ 
  icon = 'person',
  iconColor = '#fff',
  backgroundColor = '#666',
  size = 40 
}) => {
  return (
    <View 
      style={[
        styles.container, 
        { 
          width: size, 
          height: size, 
          backgroundColor,
          borderRadius: size / 2 
        }
      ]}
    >
      <Ionicons 
        name={icon as any} 
        size={size * 0.6} 
        color={iconColor} 
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});