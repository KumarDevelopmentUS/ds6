// components/SmoothTabContainer.tsx
import React, { useEffect, useState } from 'react';
import { Dimensions, Platform } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring
} from 'react-native-reanimated';

interface SmoothTabContainerProps {
  children: React.ReactNode[];
  activeTab: number; // 0 = home, 1 = feed, 2 = settings
  onTabChange: (tabIndex: number) => void;
}

const { width: screenWidth } = Dimensions.get('window');

export function SmoothTabContainer({ children, activeTab, onTabChange }: SmoothTabContainerProps) {
  const translateX = useSharedValue(-activeTab * screenWidth);
  const gestureTranslateX = useSharedValue(0);
  const isGestureActive = useSharedValue(false);
  const [preloadedTabs, setPreloadedTabs] = useState<Set<number>>(new Set([activeTab]));

  // Preload adjacent tabs for smooth transitions
  useEffect(() => {
    const tabsToPreload = new Set<number>();
    
    // Always preload current tab
    tabsToPreload.add(activeTab);
    
    // Preload adjacent tabs
    if (activeTab > 0) tabsToPreload.add(activeTab - 1);
    if (activeTab < children.length - 1) tabsToPreload.add(activeTab + 1);
    
    setPreloadedTabs(tabsToPreload);
  }, [activeTab, children.length]);

  // Animate to active tab when prop changes
  useEffect(() => {
    if (!isGestureActive.value) {
      translateX.value = withSpring(-activeTab * screenWidth, {
        damping: 20,
        stiffness: 100,
        mass: 0.8,
      });
    }
  }, [activeTab]);

  const handleTabChange = (newTabIndex: number) => {
    if (newTabIndex >= 0 && newTabIndex < children.length && newTabIndex !== activeTab) {
      onTabChange(newTabIndex);
    }
  };

  const panGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-30, 30])
    .onStart(() => {
      isGestureActive.value = true;
      gestureTranslateX.value = translateX.value;
    })
    .onUpdate((event) => {
      const { translationX } = event;
      
      // Calculate the new position
      const newTranslateX = gestureTranslateX.value + translationX;
      
      // Apply resistance at the edges
      const maxTranslateX = 0; // Right edge (first tab)
      const minTranslateX = -(children.length - 1) * screenWidth; // Left edge (last tab)
      
      let finalTranslateX = newTranslateX;
      
      // Add resistance when trying to go beyond bounds
      if (newTranslateX > maxTranslateX) {
        const overshoot = newTranslateX - maxTranslateX;
        finalTranslateX = maxTranslateX + overshoot * 0.3; // 30% resistance
      } else if (newTranslateX < minTranslateX) {
        const overshoot = minTranslateX - newTranslateX;
        finalTranslateX = minTranslateX - overshoot * 0.3; // 30% resistance
      }
      
      translateX.value = finalTranslateX;
    })
    .onEnd((event) => {
      isGestureActive.value = false;
      
      const { velocityX, translationX } = event;
      const currentTab = Math.round(-translateX.value / screenWidth);
      
      // Determine target tab based on velocity and translation
      let targetTab = currentTab;
      
      // High velocity swipe
      if (Math.abs(velocityX) > 800) {
        if (velocityX > 0 && currentTab > 0) {
          targetTab = currentTab - 1; // Swipe right to previous tab
        } else if (velocityX < 0 && currentTab < children.length - 1) {
          targetTab = currentTab + 1; // Swipe left to next tab
        }
      } 
      // Medium velocity or significant translation
      else if (Math.abs(velocityX) > 300 || Math.abs(translationX) > screenWidth * 0.3) {
        if (velocityX > 0 && translationX > 50 && currentTab > 0) {
          targetTab = currentTab - 1;
        } else if (velocityX < 0 && translationX < -50 && currentTab < children.length - 1) {
          targetTab = currentTab + 1;
        }
      }
      
      // Clamp target tab to valid range
      targetTab = Math.max(0, Math.min(children.length - 1, targetTab));
      
      // Animate to target position
      translateX.value = withSpring(-targetTab * screenWidth, {
        damping: 20,
        stiffness: 100,
        mass: 0.8,
        velocity: velocityX,
      });
      
      // Update active tab if changed
      if (targetTab !== activeTab) {
        runOnJS(handleTabChange)(targetTab);
      }
    });

  const animatedContainerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  // Only enable on mobile - return after hooks are called
  if (Platform.OS === 'web') {
    return <>{children[activeTab]}</>;
  }

  const renderTab = (child: React.ReactNode, index: number) => {
    // Only render preloaded tabs for performance
    const shouldRender = preloadedTabs.has(index);
    
    return (
      <Animated.View
        key={index}
        style={{
          width: screenWidth,
          flex: 1,
        }}
      >
        {shouldRender ? child : null}
      </Animated.View>
    );
  };

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={{ flex: 1, overflow: 'hidden' }}>
        <Animated.View
          style={[
            {
              flexDirection: 'row',
              width: screenWidth * children.length,
              flex: 1,
            },
            animatedContainerStyle,
          ]}
        >
          {children.map((child, index) => renderTab(child, index))}
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}
