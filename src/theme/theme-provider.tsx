import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider as RNThemeProvider,
} from '@react-navigation/native';
import { useMemo } from 'react';
import { COLORS } from '@/theme/colors';
import { useModeToggle } from '@/hooks/useModeToggle';

type Props = {
  children: React.ReactNode;
};

export const ThemeProvider = ({ children }: Props) => {
  const { isDark } = useModeToggle();

  const theme = useMemo(() => {
    if (isDark) {
      return {
        ...DarkTheme,
        colors: {
          ...DarkTheme.colors,
          primary: COLORS.dark.primary,
          background: COLORS.dark.background,
          card: COLORS.dark.card,
          text: COLORS.dark.text,
          border: COLORS.dark.border,
          notification: COLORS.dark.red,
        },
      };
    }

    return {
      ...DefaultTheme,
      colors: {
        ...DefaultTheme.colors,
        primary: COLORS.light.primary,
        background: COLORS.light.background,
        card: COLORS.light.card,
        text: COLORS.light.text,
        border: COLORS.light.border,
        notification: COLORS.light.red,
      },
    };
  }, [isDark]);

  return <RNThemeProvider value={theme}>{children}</RNThemeProvider>;
};
