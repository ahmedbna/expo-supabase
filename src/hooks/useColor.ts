// hooks/useColor.ts

import { COLORS } from '@/theme/colors';
import { useModeToggle } from '@/hooks/useModeToggle';

export function useColor(
  colorName: keyof typeof COLORS.light & keyof typeof COLORS.dark,
  props?: { light?: string; dark?: string }
) {
  const { isDark } = useModeToggle();
  const theme = isDark ? 'dark' : 'light';
  
  const colorFromProps = props?.[theme];

  if (colorFromProps) {
    return colorFromProps;
  } else {
    return COLORS[theme][colorName];
  }
}