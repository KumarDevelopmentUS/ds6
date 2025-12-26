// components/ui/Skeleton.tsx
import React, { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 20,
  borderRadius,
  style,
}) => {
  const { theme } = useTheme();
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 1500,
        useNativeDriver: Platform.OS !== 'web',
      })
    );
    animation.start();
    return () => animation.stop();
  }, [shimmerAnim]);

  const translateX = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-100, 100],
  });

  return (
    <View
      style={[
        styles.skeleton,
        {
          width,
          height,
          borderRadius: borderRadius ?? theme.borderRadius.sm,
          backgroundColor: theme.colors.skeleton,
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          styles.shimmer,
          {
            backgroundColor: theme.colors.skeletonHighlight,
            transform: [{ translateX }],
          },
        ]}
      />
    </View>
  );
};

// Pre-built skeleton variants
export const SkeletonText: React.FC<{ lines?: number; lastLineWidth?: string }> = ({
  lines = 1,
  lastLineWidth = '70%',
}) => {
  const { theme } = useTheme();
  return (
    <View style={styles.textContainer}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          width={index === lines - 1 ? lastLineWidth : '100%'}
          height={theme.typography.body.lineHeight}
          style={{ marginBottom: index < lines - 1 ? 8 : 0 }}
        />
      ))}
    </View>
  );
};

export const SkeletonAvatar: React.FC<{ size?: number }> = ({ size = 48 }) => {
  return <Skeleton width={size} height={size} borderRadius={size / 2} />;
};

export const SkeletonCard: React.FC = () => {
  const { theme } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.colors.card }, theme.shadows.sm as ViewStyle]}>
      <View style={styles.cardHeader}>
        <SkeletonAvatar size={40} />
        <View style={styles.cardHeaderText}>
          <Skeleton width={120} height={16} />
          <Skeleton width={80} height={12} style={{ marginTop: 4 }} />
        </View>
      </View>
      <SkeletonText lines={3} />
      <View style={styles.cardFooter}>
        <Skeleton width={60} height={24} borderRadius={12} />
        <Skeleton width={60} height={24} borderRadius={12} />
        <Skeleton width={60} height={24} borderRadius={12} />
      </View>
    </View>
  );
};

export const SkeletonListItem: React.FC = () => {
  const { theme } = useTheme();
  return (
    <View style={[styles.listItem, { borderBottomColor: theme.colors.border }]}>
      <SkeletonAvatar size={44} />
      <View style={styles.listItemContent}>
        <Skeleton width="60%" height={16} />
        <Skeleton width="40%" height={12} style={{ marginTop: 4 }} />
      </View>
      <Skeleton width={24} height={24} borderRadius={12} />
    </View>
  );
};

export const SkeletonMatchCard: React.FC = () => {
  const { theme } = useTheme();
  return (
    <View style={[styles.matchCard, { backgroundColor: theme.colors.card }, theme.shadows.sm as ViewStyle]}>
      <View style={styles.matchHeader}>
        <Skeleton width={100} height={20} />
        <Skeleton width={60} height={16} />
      </View>
      <View style={styles.matchTeams}>
        <View style={styles.matchTeam}>
          <Skeleton width={80} height={16} />
          <Skeleton width={40} height={32} borderRadius={8} style={{ marginTop: 8 }} />
        </View>
        <Skeleton width={24} height={24} borderRadius={12} />
        <View style={styles.matchTeam}>
          <Skeleton width={80} height={16} />
          <Skeleton width={40} height={32} borderRadius={8} style={{ marginTop: 8 }} />
        </View>
      </View>
      <View style={styles.matchFooter}>
        <Skeleton width="100%" height={36} borderRadius={8} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  skeleton: {
    overflow: 'hidden',
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.5,
  },
  textContainer: {
    width: '100%',
  },
  card: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardHeaderText: {
    marginLeft: 12,
    flex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 12,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  listItemContent: {
    flex: 1,
    marginLeft: 12,
  },
  matchCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  matchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  matchTeams: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  matchTeam: {
    alignItems: 'center',
    flex: 1,
  },
  matchFooter: {
    marginTop: 8,
  },
});

