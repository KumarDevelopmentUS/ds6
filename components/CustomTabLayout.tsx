// components/CustomTabLayout.tsx
import { SmoothTabContainer } from '@/components/SmoothTabContainer';
import { useHaptics } from '@/contexts/HapticsContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import { Platform, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// Import the actual tab screens
import FeedScreen from '@/app/(tabs)/_feed/index';
import HomeScreen from '@/app/(tabs)/_home';
import SettingsScreen from '@/app/(tabs)/_settings';

interface TabItem {
  name: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  component: React.ComponentType;
}

const tabs: TabItem[] = [
  {
    name: 'home',
    title: 'Home',
    icon: 'home-outline',
    component: HomeScreen,
  },
  {
    name: 'feed',
    title: 'Feed',
    icon: 'people-outline',
    component: FeedScreen,
  },
  {
    name: 'settings',
    title: 'Settings',
    icon: 'settings-outline',
    component: SettingsScreen,
  },
];

interface CustomTabLayoutProps {
  initialTab?: string;
}

export function CustomTabLayout({ initialTab }: CustomTabLayoutProps) {
  const { theme } = useTheme();
  const { vibrationEnabled } = useHaptics();
  
  // Determine initial tab index based on initialTab prop
  const getInitialTabIndex = () => {
    if (initialTab) {
      const tabIndex = tabs.findIndex(tab => tab.name === initialTab);
      return tabIndex !== -1 ? tabIndex : 0;
    }
    return 0;
  };
  
  const [activeTab, setActiveTab] = useState(getInitialTabIndex());

  const handleTabPress = (index: number) => {
    if (index !== activeTab) {
      // Trigger haptic feedback when tab changes
      if (Platform.OS === 'ios' && vibrationEnabled) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }
    setActiveTab(index);
    // Log tab changes for tracking
    const tabName = tabs[index]?.title || 'Unknown';
    console.log('Current Page:', tabName);
  };

  const handleTabChange = (tabIndex: number) => {
    setActiveTab(tabIndex);
    // Log tab changes for tracking (via swipe)
    const tabName = tabs[tabIndex]?.title || 'Unknown';
    console.log('Current Page:', tabName);
  };

  // Render tab content components
  const tabScreens = tabs.map((tab) => {
    const Component = tab.component;
    return <Component key={tab.name} />;
  });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Custom smooth tab container for mobile, fallback for web */}
      {Platform.OS !== 'web' ? (
        <SmoothTabContainer
          activeTab={activeTab}
          onTabChange={handleTabChange}
        >
          {tabScreens}
        </SmoothTabContainer>
      ) : (
        // On web, just show the current tab
        <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
          {tabScreens[activeTab]}
        </View>
      )}

      {/* Custom Tab Bar */}
      <View style={[
        styles.tabBar, 
        { 
          backgroundColor: theme.colors.tabBar,
          borderTopColor: theme.colors.border,
        }
      ]}>
        {tabs.map((tab, index) => (
          <TouchableOpacity
            key={tab.name}
            style={[
              styles.tabItem,
              activeTab === index && styles.activeTabItem,
            ]}
            onPress={() => handleTabPress(index)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={activeTab === index ? tab.icon.replace('-outline', '') as any : tab.icon}
              size={24}
              color={activeTab === index ? theme.colors.tabBarActive : theme.colors.tabBarInactive}
            />
            <Text
              style={[
                styles.tabLabel,
                { color: theme.colors.tabBarInactive },
                activeTab === index && { color: theme.colors.tabBarActive, fontWeight: '600' },
              ]}
            >
              {tab.title}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingBottom: Platform.OS === 'ios' ? 12 : 6,
    paddingTop: 6,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  activeTabItem: {
    // Add any active tab styling here if needed
  },
  tabLabel: {
    fontSize: 10,
    marginTop: 2,
    fontWeight: '500',
  },
});
