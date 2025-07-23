import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';

interface HapticsContextType {
  vibrationEnabled: boolean;
  setVibrationEnabled: (enabled: boolean) => void;
}

const HapticsContext = createContext<HapticsContextType | undefined>(undefined);

export function HapticsProvider({ children }: { children: React.ReactNode }) {
  const [vibrationEnabled, setVibrationEnabledState] = useState(true); // Default to true

  // Load vibration setting from storage on mount
  useEffect(() => {
    loadVibrationSetting();
  }, []);

  const loadVibrationSetting = async () => {
    try {
      const stored = await AsyncStorage.getItem('vibrationEnabled');
      if (stored !== null) {
        setVibrationEnabledState(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Error loading vibration setting:', error);
    }
  };

  const setVibrationEnabled = async (enabled: boolean) => {
    try {
      setVibrationEnabledState(enabled);
      await AsyncStorage.setItem('vibrationEnabled', JSON.stringify(enabled));
    } catch (error) {
      console.error('Error saving vibration setting:', error);
    }
  };

  return (
    <HapticsContext.Provider value={{ vibrationEnabled, setVibrationEnabled }}>
      {children}
    </HapticsContext.Provider>
  );
}

export function useHaptics() {
  const context = useContext(HapticsContext);
  if (context === undefined) {
    throw new Error('useHaptics must be used within a HapticsProvider');
  }
  return context;
} 