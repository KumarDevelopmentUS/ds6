// components/ui/EmptyState.tsx
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { ThemedButton } from '../themed/ThemedButton';
import { ThemedText } from '../themed/ThemedText';

type EmptyStateType = 
  | 'matches'
  | 'friends'
  | 'posts'
  | 'communities'
  | 'stats'
  | 'history'
  | 'search'
  | 'notifications'
  | 'generic';

interface EmptyStateProps {
  type?: EmptyStateType;
  title?: string;
  description?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  style?: ViewStyle;
}

const PRESETS: Record<EmptyStateType, { icon: keyof typeof Ionicons.glyphMap; title: string; description: string }> = {
  matches: {
    icon: 'game-controller-outline',
    title: 'No matches yet',
    description: 'Host or join your first match to start tracking your games.',
  },
  friends: {
    icon: 'people-outline',
    title: 'No friends yet',
    description: 'Add friends to compete on leaderboards and share your stats.',
  },
  posts: {
    icon: 'newspaper-outline',
    title: 'No posts yet',
    description: 'Be the first to share something in this community!',
  },
  communities: {
    icon: 'people-circle-outline',
    title: 'No communities yet',
    description: 'Join or create a community to connect with other players.',
  },
  stats: {
    icon: 'stats-chart-outline',
    title: 'No statistics yet',
    description: 'Play some matches to start building your stats profile.',
  },
  history: {
    icon: 'time-outline',
    title: 'No match history',
    description: 'Your completed matches will appear here.',
  },
  search: {
    icon: 'search-outline',
    title: 'No results found',
    description: 'Try adjusting your search or filters to find what you\'re looking for.',
  },
  notifications: {
    icon: 'notifications-outline',
    title: 'All caught up!',
    description: 'You don\'t have any new notifications.',
  },
  generic: {
    icon: 'folder-open-outline',
    title: 'Nothing here yet',
    description: 'Content will appear here once available.',
  },
};

export const EmptyState: React.FC<EmptyStateProps> = ({
  type = 'generic',
  title,
  description,
  icon,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  style,
}) => {
  const { theme } = useTheme();
  const preset = PRESETS[type];

  const displayIcon = icon || preset.icon;
  const displayTitle = title || preset.title;
  const displayDescription = description || preset.description;

  return (
    <View style={[styles.container, style]}>
      <View style={[styles.iconContainer, { backgroundColor: theme.colors.backgroundSecondary }]}>
        <Ionicons
          name={displayIcon}
          size={64}
          color={theme.colors.textSecondary}
        />
      </View>
      
      <ThemedText
        style={[styles.title, { color: theme.colors.text }]}
      >
        {displayTitle}
      </ThemedText>
      
      <ThemedText
        style={[styles.description, { color: theme.colors.textSecondary }]}
      >
        {displayDescription}
      </ThemedText>

      {(onAction || onSecondaryAction) && (
        <View style={styles.actions}>
          {onAction && actionLabel && (
            <ThemedButton
              title={actionLabel}
              onPress={onAction}
              variant="primary"
              size="medium"
              style={styles.primaryAction}
            />
          )}
          {onSecondaryAction && secondaryActionLabel && (
            <ThemedButton
              title={secondaryActionLabel}
              onPress={onSecondaryAction}
              variant="outline"
              size="medium"
              style={styles.secondaryAction}
            />
          )}
        </View>
      )}
    </View>
  );
};

// Specific empty states for common use cases
export const MatchesEmptyState: React.FC<{ onHostMatch?: () => void; onJoinMatch?: () => void }> = ({
  onHostMatch,
  onJoinMatch,
}) => (
  <EmptyState
    type="matches"
    actionLabel="Host a Match"
    onAction={onHostMatch}
    secondaryActionLabel="Join a Match"
    onSecondaryAction={onJoinMatch}
  />
);

export const FriendsEmptyState: React.FC<{ onAddFriends?: () => void }> = ({ onAddFriends }) => (
  <EmptyState
    type="friends"
    actionLabel="Find Friends"
    onAction={onAddFriends}
  />
);

export const PostsEmptyState: React.FC<{ onCreatePost?: () => void }> = ({ onCreatePost }) => (
  <EmptyState
    type="posts"
    actionLabel="Create Post"
    onAction={onCreatePost}
  />
);

export const StatsEmptyState: React.FC<{ onPlayMatch?: () => void }> = ({ onPlayMatch }) => (
  <EmptyState
    type="stats"
    actionLabel="Start a Match"
    onAction={onPlayMatch}
  />
);

export const SearchEmptyState: React.FC<{ onClearSearch?: () => void }> = ({ onClearSearch }) => (
  <EmptyState
    type="search"
    actionLabel="Clear Search"
    onAction={onClearSearch}
  />
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    minHeight: 300,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  description: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
  },
  actions: {
    marginTop: 24,
    alignItems: 'center',
    gap: 12,
  },
  primaryAction: {
    minWidth: 160,
  },
  secondaryAction: {
    minWidth: 160,
  },
});

