// contexts/ThemeContext.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  ColorPrimitives,
  SemanticColors,
  SpacingTokens,
  BorderRadiusTokens,
  TypographyTokens,
  ShadowTokens,
  ShadowTokensDark,
  TouchTargetTokens,
} from '../constants/designTokens';

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
    // Primary brand
    primary: string;
    primaryHover: string;
    primaryPressed: string;
    
    // Backgrounds
    background: string;
    backgroundSecondary: string;
    backgroundTertiary: string;
    
    // Surfaces
    card: string;
    cardHover: string;
    cardPressed: string;
    
    // Text
    text: string;
    textSecondary: string;
    textTertiary: string;
    textInverse: string;
    textOnPrimary: string;
    
    // Borders
    border: string;
    borderFocused: string;
    borderHover: string;
    
    // Status colors
    notification: string;
    error: string;
    errorBackground: string;
    success: string;
    successBackground: string;
    warning: string;
    warningBackground: string;
    info: string;
    infoBackground: string;
    
    // Navigation
    tabBar: string;
    tabBarActive: string;
    tabBarInactive: string;
    headerBackground: string;
    
    // Inputs
    inputBackground: string;
    inputBorder: string;
    inputFocused: string;
    inputPlaceholder: string;
    
    // Buttons
    buttonPrimary: string;
    buttonSecondary: string;
    buttonDisabled: string;
    
    // Skeleton loading
    skeleton: string;
    skeletonHighlight: string;
    
    // Overlay
    overlay: string;
    
    // Game-specific
    team1: string;
    team2: string;
    gold: string;
    silver: string;
    bronze: string;
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
  
  // Access to raw primitives for special cases
  primitives: typeof ColorPrimitives;
}

// Build theme from design tokens
const buildTheme = (mode: 'light' | 'dark'): Theme => {
  const semanticColors = SemanticColors[mode];
  const shadows = mode === 'dark' ? ShadowTokensDark : ShadowTokens;
  
  return {
    dark: mode === 'dark',
    colors: {
      // Primary brand
      primary: semanticColors.interactive,
      primaryHover: semanticColors.interactiveHover,
      primaryPressed: semanticColors.interactivePressed,
      
      // Backgrounds
      background: semanticColors.background,
      backgroundSecondary: semanticColors.backgroundSecondary,
      backgroundTertiary: semanticColors.backgroundTertiary,
      
      // Surfaces
      card: semanticColors.surface,
      cardHover: semanticColors.surfaceHover,
      cardPressed: semanticColors.surfacePressed,
      
      // Text
      text: semanticColors.textPrimary,
      textSecondary: semanticColors.textSecondary,
      textTertiary: semanticColors.textTertiary,
      textInverse: semanticColors.textInverse,
      textOnPrimary: semanticColors.textOnPrimary,
      
      // Borders
      border: semanticColors.border,
      borderFocused: semanticColors.borderFocused,
      borderHover: semanticColors.borderHover,
      
      // Status colors
      notification: semanticColors.error,
      error: semanticColors.error,
      errorBackground: semanticColors.errorBackground,
      success: semanticColors.success,
      successBackground: semanticColors.successBackground,
      warning: semanticColors.warning,
      warningBackground: semanticColors.warningBackground,
      info: semanticColors.info,
      infoBackground: semanticColors.infoBackground,
      
      // Navigation
      tabBar: semanticColors.tabBar,
      tabBarActive: semanticColors.tabBarActive,
      tabBarInactive: semanticColors.tabBarInactive,
      headerBackground: semanticColors.header,
      
      // Inputs
      inputBackground: semanticColors.inputBackground,
      inputBorder: semanticColors.inputBorder,
      inputFocused: semanticColors.inputFocused,
      inputPlaceholder: semanticColors.inputPlaceholder,
      
      // Buttons
      buttonPrimary: semanticColors.interactive,
      buttonSecondary: semanticColors.interactiveSecondary,
      buttonDisabled: semanticColors.interactiveDisabled,
      
      // Skeleton loading
      skeleton: semanticColors.skeleton,
      skeletonHighlight: semanticColors.skeletonHighlight,
      
      // Overlay
      overlay: semanticColors.overlay,
      
      // Game-specific
      team1: semanticColors.team1,
      team2: semanticColors.team2,
      gold: semanticColors.gold,
      silver: semanticColors.silver,
      bronze: semanticColors.bronze,
    },
    spacing: {
      xs: SpacingTokens.xs,
      sm: SpacingTokens.sm,
      md: SpacingTokens.md,
      lg: SpacingTokens.lg,
      xl: SpacingTokens.xl,
      xxl: SpacingTokens.xxl,
    },
    borderRadius: {
      xs: BorderRadiusTokens.xs,
      sm: BorderRadiusTokens.sm,
      md: BorderRadiusTokens.md,
      lg: BorderRadiusTokens.lg,
      xl: BorderRadiusTokens.xl,
      full: BorderRadiusTokens.full,
    },
    typography: TypographyTokens.styles,
    shadows: shadows,
    touchTargets: TouchTargetTokens,
    primitives: ColorPrimitives,
  };
};

const lightTheme = buildTheme('light');
const darkTheme = buildTheme('dark');

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

// Export design tokens for direct access when needed
export { ColorPrimitives, SemanticColors } from '../constants/designTokens';
