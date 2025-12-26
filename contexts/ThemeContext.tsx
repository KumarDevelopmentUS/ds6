// contexts/ThemeContext.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';

// Function to apply Dark Reader-style CSS filter for web
const applyDarkModeFilter = (isDark: boolean) => {
  if (typeof document === 'undefined') return;
  
  if (isDark) {
    // Create or update dark mode style
    let style = document.getElementById('dark-mode-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'dark-mode-style';
      document.head.appendChild(style);
    }
    
    // Enhanced Dark Reader-style CSS with better handling
    style.textContent = `
      /* Main inversion filter */
      html {
        background-color: #181a1b !important;
      }
      
      html, body {
        background-color: #181a1b !important;
        color: #e8e6e3 !important;
      }
      
      /* Invert main content */
      body {
        filter: invert(0.88) hue-rotate(180deg) !important;
      }
      
      /* Counter-invert images, videos, and media */
      img, video, iframe, canvas,
      [style*="background-image"],
      svg, picture {
        filter: invert(1) hue-rotate(180deg) !important;
      }
      
      /* Handle specific UI elements */
      input, textarea, select {
        background-color: #1e2021 !important;
        color: #e8e6e3 !important;
        border-color: #3e4446 !important;
      }
      
      /* Improve text contrast */
      * {
        color: inherit !important;
        border-color: inherit !important;
      }
      
      /* Fix scrollbars */
      ::-webkit-scrollbar {
        background-color: #202324 !important;
      }
      
      ::-webkit-scrollbar-thumb {
        background-color: #454a4d !important;
      }
      
      /* Prevent double inversion on certain elements */
      [data-theme="dark"] {
        filter: none !important;
      }
      
      /* Better handling of borders and shadows */
      * {
        box-shadow: none !important;
      }
    `;
  } else {
    // Remove dark mode styles
    const style = document.getElementById('dark-mode-style');
    if (style) {
      style.remove();
    }
  }
};

type ColorScheme = 'light' | 'dark';

// Typography scale following iOS Human Interface Guidelines
export interface Typography {
  hero: { fontSize: number; fontWeight: '700'; lineHeight: number };
  title1: { fontSize: number; fontWeight: '700'; lineHeight: number };
  title2: { fontSize: number; fontWeight: '600'; lineHeight: number };
  title3: { fontSize: number; fontWeight: '600'; lineHeight: number };
  headline: { fontSize: number; fontWeight: '600'; lineHeight: number };
  body: { fontSize: number; fontWeight: '400'; lineHeight: number };
  callout: { fontSize: number; fontWeight: '400'; lineHeight: number };
  subhead: { fontSize: number; fontWeight: '400'; lineHeight: number };
  footnote: { fontSize: number; fontWeight: '400'; lineHeight: number };
  caption: { fontSize: number; fontWeight: '400'; lineHeight: number };
}

// Shadow/elevation system
export interface Shadows {
  none: object;
  sm: object;
  md: object;
  lg: object;
  xl: object;
}

// Touch target sizes
export interface TouchTargets {
  minimum: number;
  comfortable: number;
  generous: number;
}

export interface Theme {
  dark: boolean;
  colors: {
    primary: string;
    primaryHover: string;
    primaryPressed: string;
    background: string;
    backgroundSecondary: string;
    card: string;
    cardHover: string;
    text: string;
    textSecondary: string;
    textTertiary: string;
    border: string;
    borderFocused: string;
    notification: string;
    error: string;
    errorBackground: string;
    success: string;
    successBackground: string;
    warning: string;
    warningBackground: string;
    info: string;
    infoBackground: string;
    tabBar: string;
    tabBarActive: string;
    headerBackground: string;
    inputBackground: string;
    inputBorder: string;
    inputFocused: string;
    buttonPrimary: string;
    buttonSecondary: string;
    skeleton: string;
    skeletonHighlight: string;
    overlay: string;
  };
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    xxl: number;
  };
  borderRadius: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    full: number;
  };
  typography: Typography;
  shadows: Shadows;
  touchTargets: TouchTargets;
}

// Shared design tokens
const sharedTypography: Typography = {
  hero: { fontSize: 34, fontWeight: '700', lineHeight: 41 },
  title1: { fontSize: 28, fontWeight: '700', lineHeight: 34 },
  title2: { fontSize: 22, fontWeight: '600', lineHeight: 28 },
  title3: { fontSize: 20, fontWeight: '600', lineHeight: 25 },
  headline: { fontSize: 17, fontWeight: '600', lineHeight: 22 },
  body: { fontSize: 17, fontWeight: '400', lineHeight: 22 },
  callout: { fontSize: 16, fontWeight: '400', lineHeight: 21 },
  subhead: { fontSize: 15, fontWeight: '400', lineHeight: 20 },
  footnote: { fontSize: 13, fontWeight: '400', lineHeight: 18 },
  caption: { fontSize: 12, fontWeight: '400', lineHeight: 16 },
};

const sharedSpacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

const sharedBorderRadius = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  full: 999,
};

const sharedTouchTargets: TouchTargets = {
  minimum: 44,      // iOS HIG minimum
  comfortable: 48,  // Android Material minimum
  generous: 56,     // Preferred for primary actions
};

const lightTheme: Theme = {
  dark: false,
  colors: {
    primary: '#007AFF',
    primaryHover: '#0051D5',
    primaryPressed: '#003D99',
    background: '#F2F2F7',
    backgroundSecondary: '#FFFFFF',
    card: '#FFFFFF',
    cardHover: '#F9F9F9',
    text: '#000000',
    textSecondary: '#666666',
    textTertiary: '#999999',
    border: '#E5E5EA',
    borderFocused: '#007AFF',
    notification: '#FF3B30',
    error: '#FF3B30',
    errorBackground: '#FEE2E2',
    success: '#34C759',
    successBackground: '#DCFCE7',
    warning: '#FF9500',
    warningBackground: '#FEF3C7',
    info: '#5856D6',
    infoBackground: '#EDE9FE',
    tabBar: '#FFFFFF',
    tabBarActive: '#007AFF',
    headerBackground: '#F2F2F7',
    inputBackground: '#FFFFFF',
    inputBorder: '#E5E5EA',
    inputFocused: '#007AFF',
    buttonPrimary: '#007AFF',
    buttonSecondary: '#E5E5EA',
    skeleton: '#E5E5EA',
    skeletonHighlight: '#F5F5F5',
    overlay: 'rgba(0, 0, 0, 0.5)',
  },
  spacing: sharedSpacing,
  borderRadius: sharedBorderRadius,
  typography: sharedTypography,
  shadows: {
    none: {},
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 4,
    },
    xl: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.2,
      shadowRadius: 16,
      elevation: 8,
    },
  },
  touchTargets: sharedTouchTargets,
};

const darkTheme: Theme = {
  dark: true,
  colors: {
    primary: '#0A84FF',
    primaryHover: '#409CFF',
    primaryPressed: '#0066CC',
    background: '#000000',
    backgroundSecondary: '#1C1C1E',
    card: '#1C1C1E',
    cardHover: '#2C2C2E',
    text: '#FFFFFF',
    textSecondary: '#999999',
    textTertiary: '#666666',
    border: '#38383A',
    borderFocused: '#0A84FF',
    notification: '#FF453A',
    error: '#FF453A',
    errorBackground: '#3D1F1F',
    success: '#32D74B',
    successBackground: '#1F3D1F',
    warning: '#FF9F0A',
    warningBackground: '#3D3D1F',
    info: '#5E5CE6',
    infoBackground: '#1F1F3D',
    tabBar: '#1C1C1E',
    tabBarActive: '#0A84FF',
    headerBackground: '#1C1C1E',
    inputBackground: '#2C2C2E',
    inputBorder: '#38383A',
    inputFocused: '#0A84FF',
    buttonPrimary: '#0A84FF',
    buttonSecondary: '#38383A',
    skeleton: '#38383A',
    skeletonHighlight: '#48484A',
    overlay: 'rgba(0, 0, 0, 0.7)',
  },
  spacing: sharedSpacing,
  borderRadius: sharedBorderRadius,
  typography: sharedTypography,
  shadows: {
    none: {},
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.3,
      shadowRadius: 2,
      elevation: 1,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.4,
      shadowRadius: 4,
      elevation: 2,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.5,
      shadowRadius: 8,
      elevation: 4,
    },
    xl: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.6,
      shadowRadius: 16,
      elevation: 8,
    },
  },
  touchTargets: sharedTouchTargets,
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
      const savedScheme = await AsyncStorage.getItem('colorScheme');
      if (savedScheme === 'dark' || savedScheme === 'light') {
        setColorScheme(savedScheme);
      }
    } catch (error) {
      console.error('Error loading theme preference:', error);
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
    const newScheme = colorScheme === 'light' ? 'dark' : 'light';
    setColorScheme(newScheme);
    saveThemePreference(newScheme);
    
    // Apply CSS filter for web dark mode
    if (typeof document !== 'undefined') {
      applyDarkModeFilter(newScheme === 'dark');
    }
  };

  const handleSetColorScheme = (scheme: ColorScheme) => {
    setColorScheme(scheme);
    saveThemePreference(scheme);
    
    // Apply CSS filter for web dark mode
    if (typeof document !== 'undefined') {
      applyDarkModeFilter(scheme === 'dark');
    }
  };

  // Apply dark mode filter on initial load
  useEffect(() => {
    if (typeof document !== 'undefined') {
      applyDarkModeFilter(colorScheme === 'dark');
    }
  }, [colorScheme]);

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
