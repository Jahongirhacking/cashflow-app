import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SystemUI from 'expo-system-ui';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Platform, useColorScheme } from 'react-native';
import {
  chartColors,
  type ChartColors,
  type ColorScheme,
  darkColors,
  lightColors,
  radii,
  spacing,
  type ThemeColors,
  typography,
} from './tokens';

export type ThemeMode = 'system' | ColorScheme;

export interface Theme {
  scheme: ColorScheme;
  isDark: boolean;
  colors: ThemeColors;
  chart: ChartColors;
  spacing: typeof spacing;
  radii: typeof radii;
  typography: typeof typography;
}

interface ThemeContextValue {
  theme: Theme;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  /** True once the persisted preference has been read; lets the splash screen wait. */
  isReady: boolean;
}

const STORAGE_KEY = 'finance.theme-mode';
const ThemeContext = createContext<ThemeContextValue | null>(null);

function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'system' || value === 'light' || value === 'dark';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (!cancelled && isThemeMode(stored)) setModeState(stored);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setIsReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
  }, []);

  const scheme: ColorScheme =
    mode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : mode;

  const theme = useMemo<Theme>(
    () => ({
      scheme,
      isDark: scheme === 'dark',
      colors: scheme === 'dark' ? darkColors : lightColors,
      chart: chartColors(scheme),
      spacing,
      radii,
      typography,
    }),
    [scheme],
  );

  useEffect(() => {
    if (Platform.OS !== 'web') {
      SystemUI.setBackgroundColorAsync(theme.colors.background).catch(() => undefined);
    } else if (typeof document !== 'undefined') {
      document.documentElement.style.backgroundColor = theme.colors.background;
      document.documentElement.style.colorScheme = theme.scheme;
    }
  }, [theme]);

  const value = useMemo(() => ({ theme, mode, setMode, isReady }), [theme, mode, setMode, isReady]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx.theme;
}

export function useThemeMode(): Pick<ThemeContextValue, 'mode' | 'setMode' | 'isReady'> {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useThemeMode must be used within ThemeProvider');
  return { mode: ctx.mode, setMode: ctx.setMode, isReady: ctx.isReady };
}
