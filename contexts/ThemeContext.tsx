// contexts/ThemeContext.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';

type ColorScheme = 'light' | 'dark';

interface Theme {
  dark: boolean;
  colors: {
    primary: string;
    background: string;
    card: string;
    text: string;
    textSecondary: string;
    border: string;
    notification: string;
    error: string;
    success: string;
    warning: string;
    info: string;
    tabBar: string;
    tabBarActive: string;
    headerBackground: string;
    inputBackground: string;
    buttonPrimary: string;
    buttonSecondary: string;
  };
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
  borderRadius: {
    sm: number;
    md: number;
    lg: number;
    full: number;
  };
}

const lightTheme: Theme = {
  dark: false,
  colors: {
    primary: '#007AFF',
    background: '#F2F2F7',
    card: '#FFFFFF',
    text: '#000000',
    textSecondary: '#666666',
    border: '#E5E5EA',
    notification: '#FF3B30',
    error: '#FF3B30',
    success: '#34C759',
    warning: '#FF9500',
    info: '#5856D6',
    tabBar: '#FFFFFF',
    tabBarActive: '#007AFF',
    headerBackground: '#F2F2F7',
    inputBackground: '#FFFFFF',
    buttonPrimary: '#007AFF',
    buttonSecondary: '#E5E5EA',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 12,
    full: 999,
  },
};

const darkTheme: Theme = {
  dark: true,
  colors: {
    primary: '#0A84FF',
    background: '#000000',
    card: '#1C1C1E',
    text: '#FFFFFF',
    textSecondary: '#999999',
    border: '#38383A',
    notification: '#FF453A',
    error: '#FF453A',
    success: '#32D74B',
    warning: '#FF9F0A',
    info: '#5E5CE6',
    tabBar: '#1C1C1E',
    tabBarActive: '#0A84FF',
    headerBackground: '#1C1C1E',
    inputBackground: '#2C2C2E',
    buttonPrimary: '#0A84FF',
    buttonSecondary: '#38383A',
  },
  spacing: lightTheme.spacing,
  borderRadius: lightTheme.borderRadius,
};

interface ThemeContextType {
  theme: Theme;
  colorScheme: ColorScheme;
  toggleColorScheme: () => void;
  setColorScheme: (scheme: ColorScheme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [colorScheme, setColorScheme] = useState<ColorScheme>('light'); // Default to light mode

  useEffect(() => {
    loadThemePreference();
  }, []);

  const loadThemePreference = async () => {
    try {
      // Force light mode - ignore any saved dark mode preferences
      setColorScheme('light');
      saveThemePreference('light');
    } catch (error) {
      console.error('Error loading theme preference:', error);
      // On error, default to light mode
      setColorScheme('light');
    }
  };

  const saveThemePreference = async (scheme: ColorScheme) => {
    try {
      await AsyncStorage.setItem('colorScheme', scheme);
    } catch (error) {
      console.error('Error saving theme preference:', error);
    }
  };

  const toggleColorScheme = () => {
    // Dark mode is disabled - always stay in light mode
    // This function is kept for compatibility but doesn't change the theme
    console.log('Dark mode is disabled - staying in light mode');
  };

  const handleSetColorScheme = (scheme: ColorScheme) => {
    // Force light mode regardless of what's requested
    if (scheme !== 'light') {
      console.log('Dark mode is disabled - forcing light mode');
      scheme = 'light';
    }
    setColorScheme(scheme);
    saveThemePreference(scheme);
  };

  const theme = colorScheme === 'dark' ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider
      value={{
        theme,
        colorScheme,
        toggleColorScheme,
        setColorScheme: handleSetColorScheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
