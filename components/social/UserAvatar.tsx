// components/social/UserAvatar.tsx
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

interface UserAvatarProps {
  icon?: string;
  iconColor?: string;
  backgroundColor?: string;
  size?: number;
  profilePictureUrl?: string | null;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({ 
  icon = 'person',
  iconColor = '#fff',
  backgroundColor = '#666',
  size = 40,
  profilePictureUrl
}) => {
  // If there's a profile picture, show it; otherwise show the icon-based avatar
  if (profilePictureUrl) {
    return (
      <Image 
        source={{ uri: profilePictureUrl }}
        style={[
          styles.container,
          {
            width: size,
            height: size,
            borderRadius: size / 2
          }
        ]}
        resizeMode="cover"
      />
    );
  }

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