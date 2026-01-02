// constants/designTokens.ts
// ============================================================================
// DESIGN TOKENS - Single source of truth for all design values
// ============================================================================
// To change the app's color scheme globally, modify the PRIMITIVE colors below.
// Semantic colors reference these primitives, ensuring consistency.
// ============================================================================

// ============================================================================
// COLOR PRIMITIVES
// These are the raw color values. Change these to update the entire app's palette.
// ============================================================================

export const ColorPrimitives = {
  // Brand Colors - The primary identity of the app
  // Change these to completely rebrand the app
  brand: {
    primary: '#3b82f6',      // Main brand color (blue)
    primaryLight: '#60a5fa', // Lighter variant
    primaryDark: '#2563eb',  // Darker variant
    primaryDarker: '#1d4ed8', // Even darker for pressed states
  },

  // Neutral Colors - Grays for backgrounds, text, borders
  neutral: {
    // Light mode neutrals
    white: '#FFFFFF',
    gray50: '#F9FAFB',
    gray100: '#F3F4F6',
    gray200: '#E5E7EB',
    gray300: '#D1D5DB',
    gray400: '#9CA3AF',
    gray500: '#6B7280',
    gray600: '#4B5563',
    gray700: '#374151',
    gray800: '#1F2937',
    gray900: '#111827',
    black: '#000000',
    
    // Dark mode specific neutrals (iOS-style)
    darkBackground: '#000000',
    darkSurface: '#1C1C1E',
    darkSurfaceElevated: '#2C2C2E',
    darkBorder: '#38383A',
    darkBorderElevated: '#48484A',
  },

  // Semantic Colors - Status and feedback colors
  status: {
    // Success (green)
    success: '#22c55e',
    successLight: '#86efac',
    successDark: '#16a34a',
    successBackground: '#DCFCE7',
    successBackgroundDark: '#1F3D1F',

    // Error/Danger (red)
    error: '#ef4444',
    errorLight: '#fca5a5',
    errorDark: '#dc2626',
    errorBackground: '#FEE2E2',
    errorBackgroundDark: '#3D1F1F',

    // Warning (orange/amber)
    warning: '#f59e0b',
    warningLight: '#fcd34d',
    warningDark: '#d97706',
    warningBackground: '#FEF3C7',
    warningBackgroundDark: '#3D3D1F',

    // Info (purple)
    info: '#8b5cf6',
    infoLight: '#c4b5fd',
    infoDark: '#7c3aed',
    infoBackground: '#EDE9FE',
    infoBackgroundDark: '#1F1F3D',
  },

  // Game-specific Colors - Used in the tracker and stats
  game: {
    team1: '#3b82f6',         // Blue team
    team1Light: '#93c5fd',
    team2: '#ef4444',         // Red team
    team2Light: '#fca5a5',
    gold: '#FFD700',          // Achievement gold
    silver: '#C0C0C0',        // Achievement silver
    bronze: '#CD7F32',        // Achievement bronze
    streak: '#f59e0b',        // Streak/fire color
  },

  // Overlay Colors
  overlay: {
    light: 'rgba(0, 0, 0, 0.5)',
    dark: 'rgba(0, 0, 0, 0.7)',
    lightSoft: 'rgba(0, 0, 0, 0.3)',
    darkSoft: 'rgba(0, 0, 0, 0.4)',
  },
} as const;

// ============================================================================
// SEMANTIC COLOR TOKENS
// These map primitives to meaningful UI concepts
// ============================================================================

export const SemanticColors = {
  light: {
    // Backgrounds
    background: ColorPrimitives.neutral.gray100,
    backgroundSecondary: ColorPrimitives.neutral.white,
    backgroundTertiary: ColorPrimitives.neutral.gray50,
    
    // Surfaces (cards, modals, etc.)
    surface: ColorPrimitives.neutral.white,
    surfaceHover: ColorPrimitives.neutral.gray50,
    surfacePressed: ColorPrimitives.neutral.gray100,
    surfaceElevated: ColorPrimitives.neutral.white,
    
    // Text
    textPrimary: ColorPrimitives.neutral.gray900,
    textSecondary: ColorPrimitives.neutral.gray600,
    textTertiary: ColorPrimitives.neutral.gray400,
    textInverse: ColorPrimitives.neutral.white,
    textOnPrimary: ColorPrimitives.neutral.white,
    
    // Interactive - Primary
    interactive: ColorPrimitives.brand.primary,
    interactiveHover: ColorPrimitives.brand.primaryDark,
    interactivePressed: ColorPrimitives.brand.primaryDarker,
    interactiveDisabled: ColorPrimitives.neutral.gray300,
    
    // Interactive - Secondary
    interactiveSecondary: ColorPrimitives.neutral.gray200,
    interactiveSecondaryHover: ColorPrimitives.neutral.gray300,
    
    // Borders
    border: ColorPrimitives.neutral.gray200,
    borderFocused: ColorPrimitives.brand.primary,
    borderHover: ColorPrimitives.neutral.gray300,
    
    // Inputs
    inputBackground: ColorPrimitives.neutral.white,
    inputBorder: ColorPrimitives.neutral.gray200,
    inputFocused: ColorPrimitives.brand.primary,
    inputPlaceholder: ColorPrimitives.neutral.gray400,
    
    // Navigation
    tabBar: ColorPrimitives.neutral.white,
    tabBarActive: ColorPrimitives.brand.primary,
    tabBarInactive: ColorPrimitives.neutral.gray400,
    header: ColorPrimitives.neutral.gray100,
    
    // Status
    success: ColorPrimitives.status.success,
    successBackground: ColorPrimitives.status.successBackground,
    error: ColorPrimitives.status.error,
    errorBackground: ColorPrimitives.status.errorBackground,
    warning: ColorPrimitives.status.warning,
    warningBackground: ColorPrimitives.status.warningBackground,
    info: ColorPrimitives.status.info,
    infoBackground: ColorPrimitives.status.infoBackground,
    
    // Skeleton loading
    skeleton: ColorPrimitives.neutral.gray200,
    skeletonHighlight: ColorPrimitives.neutral.gray100,
    
    // Overlay
    overlay: ColorPrimitives.overlay.light,
    
    // Game specific
    team1: ColorPrimitives.game.team1,
    team2: ColorPrimitives.game.team2,
    gold: ColorPrimitives.game.gold,
    silver: ColorPrimitives.game.silver,
    bronze: ColorPrimitives.game.bronze,
  },
  
  dark: {
    // Backgrounds
    background: ColorPrimitives.neutral.darkBackground,
    backgroundSecondary: ColorPrimitives.neutral.darkSurface,
    backgroundTertiary: ColorPrimitives.neutral.darkSurfaceElevated,
    
    // Surfaces
    surface: ColorPrimitives.neutral.darkSurface,
    surfaceHover: ColorPrimitives.neutral.darkSurfaceElevated,
    surfacePressed: ColorPrimitives.neutral.darkBorder,
    surfaceElevated: ColorPrimitives.neutral.darkSurfaceElevated,
    
    // Text
    textPrimary: ColorPrimitives.neutral.white,
    textSecondary: ColorPrimitives.neutral.gray400,
    textTertiary: ColorPrimitives.neutral.gray600,
    textInverse: ColorPrimitives.neutral.black,
    textOnPrimary: ColorPrimitives.neutral.white,
    
    // Interactive - Primary (slightly brighter for dark mode)
    interactive: ColorPrimitives.brand.primaryLight,
    interactiveHover: ColorPrimitives.brand.primary,
    interactivePressed: ColorPrimitives.brand.primaryDark,
    interactiveDisabled: ColorPrimitives.neutral.gray700,
    
    // Interactive - Secondary
    interactiveSecondary: ColorPrimitives.neutral.darkBorder,
    interactiveSecondaryHover: ColorPrimitives.neutral.darkBorderElevated,
    
    // Borders
    border: ColorPrimitives.neutral.darkBorder,
    borderFocused: ColorPrimitives.brand.primaryLight,
    borderHover: ColorPrimitives.neutral.darkBorderElevated,
    
    // Inputs
    inputBackground: ColorPrimitives.neutral.darkSurfaceElevated,
    inputBorder: ColorPrimitives.neutral.darkBorder,
    inputFocused: ColorPrimitives.brand.primaryLight,
    inputPlaceholder: ColorPrimitives.neutral.gray600,
    
    // Navigation
    tabBar: ColorPrimitives.neutral.darkSurface,
    tabBarActive: ColorPrimitives.brand.primaryLight,
    tabBarInactive: ColorPrimitives.neutral.gray600,
    header: ColorPrimitives.neutral.darkSurface,
    
    // Status
    success: ColorPrimitives.status.successLight,
    successBackground: ColorPrimitives.status.successBackgroundDark,
    error: ColorPrimitives.status.errorLight,
    errorBackground: ColorPrimitives.status.errorBackgroundDark,
    warning: ColorPrimitives.status.warningLight,
    warningBackground: ColorPrimitives.status.warningBackgroundDark,
    info: ColorPrimitives.status.infoLight,
    infoBackground: ColorPrimitives.status.infoBackgroundDark,
    
    // Skeleton loading
    skeleton: ColorPrimitives.neutral.darkBorder,
    skeletonHighlight: ColorPrimitives.neutral.darkBorderElevated,
    
    // Overlay
    overlay: ColorPrimitives.overlay.dark,
    
    // Game specific
    team1: ColorPrimitives.game.team1Light,
    team2: ColorPrimitives.game.team2Light,
    gold: ColorPrimitives.game.gold,
    silver: ColorPrimitives.game.silver,
    bronze: ColorPrimitives.game.bronze,
  },
} as const;

// ============================================================================
// SPACING TOKENS
// Consistent spacing scale based on 4px base unit
// ============================================================================

export const SpacingTokens = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
} as const;

// ============================================================================
// BORDER RADIUS TOKENS
// ============================================================================

export const BorderRadiusTokens = {
  none: 0,
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 24,
  full: 9999,
} as const;

// ============================================================================
// TYPOGRAPHY TOKENS
// Based on iOS Human Interface Guidelines
// ============================================================================

export const TypographyTokens = {
  fontWeights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
  
  fontSizes: {
    xs: 12,
    sm: 13,
    md: 15,
    base: 16,
    lg: 17,
    xl: 20,
    '2xl': 22,
    '3xl': 28,
    '4xl': 34,
  },
  
  lineHeights: {
    xs: 16,
    sm: 18,
    md: 20,
    base: 21,
    lg: 22,
    xl: 25,
    '2xl': 28,
    '3xl': 34,
    '4xl': 41,
  },
  
  // Pre-defined text styles
  styles: {
    hero: { fontSize: 34, fontWeight: '700' as const, lineHeight: 41 },
    title1: { fontSize: 28, fontWeight: '700' as const, lineHeight: 34 },
    title2: { fontSize: 22, fontWeight: '600' as const, lineHeight: 28 },
    title3: { fontSize: 20, fontWeight: '600' as const, lineHeight: 25 },
    headline: { fontSize: 17, fontWeight: '600' as const, lineHeight: 22 },
    body: { fontSize: 17, fontWeight: '400' as const, lineHeight: 22 },
    callout: { fontSize: 16, fontWeight: '400' as const, lineHeight: 21 },
    subhead: { fontSize: 15, fontWeight: '400' as const, lineHeight: 20 },
    footnote: { fontSize: 13, fontWeight: '400' as const, lineHeight: 18 },
    caption: { fontSize: 12, fontWeight: '400' as const, lineHeight: 16 },
  },
} as const;

// ============================================================================
// SHADOW TOKENS
// ============================================================================

export const ShadowTokens = {
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
} as const;

export const ShadowTokensDark = {
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
} as const;

// ============================================================================
// TOUCH TARGET TOKENS
// Based on accessibility guidelines (iOS HIG, Material Design)
// ============================================================================

export const TouchTargetTokens = {
  minimum: 44,      // iOS HIG minimum
  comfortable: 48,  // Android Material minimum
  generous: 56,     // Preferred for primary actions
} as const;

// ============================================================================
// ANIMATION TOKENS
// ============================================================================

export const AnimationTokens = {
  duration: {
    instant: 0,
    fast: 100,
    normal: 200,
    slow: 300,
    slower: 500,
  },
  easing: {
    // These are string identifiers for the animation library to use
    easeIn: 'ease-in',
    easeOut: 'ease-out',
    easeInOut: 'ease-in-out',
    spring: 'spring',
  },
} as const;

// ============================================================================
// Z-INDEX TOKENS
// Consistent layering system
// ============================================================================

export const ZIndexTokens = {
  base: 0,
  dropdown: 100,
  sticky: 200,
  fixed: 300,
  modalBackdrop: 400,
  modal: 500,
  popover: 600,
  tooltip: 700,
  toast: 800,
} as const;

// ============================================================================
// BREAKPOINTS (for responsive design)
// ============================================================================

export const BreakpointTokens = {
  sm: 640,   // Mobile landscape
  md: 768,   // Tablet portrait
  lg: 1024,  // Tablet landscape / Small desktop
  xl: 1280,  // Desktop
  xxl: 1536, // Large desktop
} as const;

// ============================================================================
// HELPER TYPE EXPORTS
// ============================================================================

export type ColorPrimitivesType = typeof ColorPrimitives;
export type SemanticColorsType = typeof SemanticColors;
export type SpacingTokensType = typeof SpacingTokens;
export type BorderRadiusTokensType = typeof BorderRadiusTokens;
export type TypographyTokensType = typeof TypographyTokens;

