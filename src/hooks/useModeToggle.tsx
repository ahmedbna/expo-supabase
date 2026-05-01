import {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  ReactNode,
} from 'react';
import { Platform, useColorScheme, ColorSchemeName } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { setBackgroundColorAsync } from 'expo-system-ui';
import * as NavigationBar from 'expo-navigation-bar';
import { COLORS } from '@/theme/colors';

type Mode = 'light' | 'dark' | 'system';

interface ThemeToggleContextType {
  isDark: boolean;
  mode: Mode;
  setMode: (mode: Mode) => Promise<void>;
  toggleMode: () => Promise<void>;
  currentMode: ColorSchemeName;
  isReady: boolean;
}

const ThemeToggleContext = createContext<ThemeToggleContextType | null>(null);

const STORAGE_KEY = 'app-theme-mode';

export const ThemeToggleProvider = ({ children }: { children: ReactNode }) => {
  const systemColorScheme = useColorScheme();

  const [mode, setModeState] = useState<Mode>('system');
  const [isReady, setIsReady] = useState(false);

  // Load saved theme
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedMode = await SecureStore.getItemAsync(STORAGE_KEY);

        if (
          savedMode === 'light' ||
          savedMode === 'dark' ||
          savedMode === 'system'
        ) {
          setModeState(savedMode);
        }
      } catch (e) {
        console.error('Failed to load theme preference', e);
      } finally {
        setIsReady(true);
      }
    };

    loadTheme();
  }, []);

  // Derived state
  const isDark =
    mode === 'system' ? systemColorScheme === 'dark' : mode === 'dark';

  // Side effects (system UI)
  useEffect(() => {
    if (!isReady) return;

    setBackgroundColorAsync(
      isDark ? COLORS.dark.background : COLORS.light.background,
    );

    if (Platform.OS === 'android') {
      NavigationBar.setButtonStyleAsync(isDark ? 'light' : 'dark');
    }
  }, [isDark, isReady]);

  // Set mode
  const setMode = async (newMode: Mode) => {
    setModeState(newMode);

    try {
      await SecureStore.setItemAsync(STORAGE_KEY, newMode);
    } catch (e) {
      console.error('Failed to save theme preference', e);
    }
  };

  // Toggle mode (clean cycle)
  const toggleMode = async () => {
    const modes: Mode[] = ['light', 'dark', 'system'];
    const next = modes[(modes.indexOf(mode) + 1) % modes.length];
    await setMode(next);
  };

  // Memoized context value
  const value = useMemo(
    () => ({
      isDark,
      mode,
      setMode,
      toggleMode,
      currentMode: mode === 'system' ? systemColorScheme : mode,
      isReady,
    }),
    [isDark, mode, systemColorScheme, isReady],
  );

  // Prevent flicker
  if (!isReady) return null;

  return (
    <ThemeToggleContext.Provider value={value}>
      {children}
    </ThemeToggleContext.Provider>
  );
};

// Hook
export const useModeToggle = () => {
  const context = useContext(ThemeToggleContext);
  if (!context) {
    throw new Error('useModeToggle must be used within ThemeToggleProvider');
  }
  return context;
};
