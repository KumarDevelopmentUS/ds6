// contexts/ThemeContext.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  BorderRadiusTokens,
  ColorPrimitives,
  SemanticColors,
  ShadowTokens,
  ShadowTokensDark,
  SpacingTokens,
  TouchTargetTokens,
  TypographyTokens,
} from '../constants/designTokens';

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
    textPrimary: string;  // Alias for consistency
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
    
    // Game-specific (preserved for user content)
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
      textPrimary: semanticColors.textPrimary,  // Alias for consistency
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
      
      // Game-specific (preserved for user content - not affected by dark mode)
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
  const [colorScheme, setColorScheme] = useState<ColorScheme>('light');

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
  };

  const handleSetColorScheme = (scheme: ColorScheme) => {
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

// Export design tokens for direct access when needed
export { ColorPrimitives, SemanticColors } from '../constants/designTokens';
