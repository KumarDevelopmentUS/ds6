// app/(tabs)/_layout.tsx
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import PagerView from 'react-native-pager-view';

// Lazy load tab screens to avoid double-mounting
const HomeScreen = React.lazy(() => import('./home'));
const FeedScreen = React.lazy(() => import('./feed/index'));
const SettingsScreen = React.lazy(() => import('./settings'));

const TAB_ROUTES = [
  { key: 'home', title: 'Home', icon: 'home-outline', component: HomeScreen },
  { key: 'feed', title: 'Feed', icon: 'people-outline', component: FeedScreen },
  { key: 'settings', title: 'Settings', icon: 'settings-outline', component: SettingsScreen },
];

export default function TabLayout() {
  const pagerRef = useRef(null);
  const [tabIndex, setTabIndex] = useState(0);

  // Handle tab press
  const handleTabPress = useCallback((index) => {
    setTabIndex(index);
    if (pagerRef.current) {
      pagerRef.current.setPage(index);
    }
  }, []);

  // Handle swipe
  const handlePageSelected = useCallback((e) => {
    setTabIndex(e.nativeEvent.position);
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <PagerView
        ref={pagerRef}
        style={{ flex: 1 }}
        initialPage={0}
        onPageSelected={handlePageSelected}
        scrollEnabled={true}
        overdrag={true}
        layoutDirection={Platform.OS === 'ios' ? 'ltr' : undefined}
      >
        {TAB_ROUTES.map((tab, idx) => (
          <View key={tab.key} style={{ flex: 1 }}>
            <React.Suspense fallback={null}>
              <tab.component />
            </React.Suspense>
          </View>
        ))}
      </PagerView>
      <View style={styles.tabBar}>
        {TAB_ROUTES.map((tab, idx) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tabButton, tabIndex === idx && styles.tabButtonActive]}
            onPress={() => handleTabPress(idx)}
            accessibilityLabel={tab.title}
          >
            <Ionicons
              name={tab.icon}
              size={26}
              color={tabIndex === idx ? '#007AFF' : '#888'}
            />
            <Text style={[styles.tabLabel, tabIndex === idx && styles.tabLabelActive]}>
              {tab.title}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    height: 60,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  tabButtonActive: {
    // Optionally add a highlight or shadow
  },
  tabLabel: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  tabLabelActive: {
    color: '#007AFF',
    fontWeight: '600',
  },
});
