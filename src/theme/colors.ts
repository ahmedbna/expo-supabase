// theme/colors.ts

import { Platform } from 'react-native';

export const lightColors = {
  background: '#FFFFFF',
  primary: '#18181b',
  card: '#F2F2F7',
  text: '#000000',
  border: '#E5E5EA',
  red: '#FF3B30',
};

export const darkColors = {
  background: '#000000',
  primary: '#e4e4e7',
  card: '#1C1C1E',
  text: '#FFFFFF',
  border: '#38383A',
  red: '#FF453A',
};

export const COLORS = {
  light: lightColors,
  dark: darkColors,
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
