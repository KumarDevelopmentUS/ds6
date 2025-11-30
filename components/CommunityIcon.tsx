// components/CommunityIcon.tsx
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';

interface CommunityIconProps {
  icon?: string | null;
  iconColor?: string | null;
  backgroundColor?: string | null;
  size?: number;
  style?: ViewStyle;
}

export const CommunityIcon: React.FC<CommunityIconProps> = ({
  icon = 'people',
  iconColor = '#FFFFFF',
  backgroundColor = '#007AFF',
  size = 40,
  style,
}) => {
  // Ensure the icon is a valid Ionicons name, fallback to 'people' if not
  const validIcon = (icon as keyof typeof Ionicons.glyphMap) || 'people';

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: backgroundColor || '#007AFF',
        },
        style,
      ]}
    >
      <Ionicons
        name={validIcon}
        size={size * 0.55}
        color={iconColor || '#FFFFFF'}
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

export default CommunityIcon;

