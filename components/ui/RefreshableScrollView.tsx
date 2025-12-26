// components/ui/RefreshableScrollView.tsx
import React, { useState } from 'react';
import {
  Platform,
  RefreshControl,
  ScrollView,
  ScrollViewProps,
  StyleSheet,
  View,
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

interface RefreshableScrollViewProps extends ScrollViewProps {
  onRefresh?: () => Promise<void> | void;
  refreshing?: boolean;
  children: React.ReactNode;
}

export const RefreshableScrollView: React.FC<RefreshableScrollViewProps> = ({
  onRefresh,
  refreshing: externalRefreshing,
  children,
  contentContainerStyle,
  ...props
}) => {
  const { theme } = useTheme();
  const [internalRefreshing, setInternalRefreshing] = useState(false);

  const refreshing = externalRefreshing ?? internalRefreshing;

  const handleRefresh = async () => {
    if (!onRefresh) return;
    
    setInternalRefreshing(true);
    try {
      await onRefresh();
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      setInternalRefreshing(false);
    }
  };

  // On web, we don't have pull-to-refresh, so just render a regular ScrollView
  if (Platform.OS === 'web') {
    return (
      <ScrollView
        contentContainerStyle={contentContainerStyle}
        showsVerticalScrollIndicator={true}
        {...props}
      >
        {children}
      </ScrollView>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={contentContainerStyle}
      showsVerticalScrollIndicator={true}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
            progressBackgroundColor={theme.colors.card}
          />
        ) : undefined
      }
      keyboardDismissMode="on-drag"
      {...props}
    >
      {children}
    </ScrollView>
  );
};

// Wrapper for FlatList-like behavior with better performance
interface RefreshableFlatListProps<T> extends Omit<RefreshableScrollViewProps, 'children'> {
  data: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  keyExtractor: (item: T, index: number) => string;
  ListHeaderComponent?: React.ReactNode;
  ListFooterComponent?: React.ReactNode;
  ListEmptyComponent?: React.ReactNode;
  ItemSeparatorComponent?: React.ReactNode;
}

export function RefreshableList<T>({
  data,
  renderItem,
  keyExtractor,
  ListHeaderComponent,
  ListFooterComponent,
  ListEmptyComponent,
  ItemSeparatorComponent,
  ...props
}: RefreshableFlatListProps<T>) {
  return (
    <RefreshableScrollView {...props}>
      {ListHeaderComponent}
      {data.length === 0 ? (
        ListEmptyComponent
      ) : (
        data.map((item, index) => (
          <React.Fragment key={keyExtractor(item, index)}>
            {renderItem(item, index)}
            {index < data.length - 1 && ItemSeparatorComponent}
          </React.Fragment>
        ))
      )}
      {ListFooterComponent}
    </RefreshableScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

