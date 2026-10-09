import { Platform, type TextStyle, type ViewStyle } from 'react-native';

export type ColorScheme = 'light' | 'dark';

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceElevated: string;
  surfaceMuted: string;
  border: string;
  borderStrong: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  primary: string;
  primaryHover: string;
  onPrimary: string;
  primarySoft: string;
  income: string;
  incomeSoft: string;
  expense: string;
  expenseSoft: string;
  warning: string;
  warningSoft: string;
  info: string;
  infoSoft: string;
  overlay: string;
  skeleton: string;
  focusRing: string;
}

export const lightColors: ThemeColors = {
  background: '#F5F6F8',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceMuted: '#EEF0F3',
  border: '#E4E7EB',
  borderStrong: '#CBD2DA',
  text: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  primary: '#0F172A',
  primaryHover: '#1E293B',
  onPrimary: '#FFFFFF',
  primarySoft: '#E2E8F0',
  income: '#15803D',
  incomeSoft: '#DCFCE7',
  expense: '#B91C1C',
  expenseSoft: '#FEE2E2',
  warning: '#B45309',
  warningSoft: '#FEF3C7',
  info: '#1D4ED8',
  infoSoft: '#DBEAFE',
  overlay: 'rgba(15, 23, 42, 0.45)',
  skeleton: '#E6E9EE',
  focusRing: '#2563EB',
};

export const darkColors: ThemeColors = {
  background: '#0B0F14',
  surface: '#131920',
  surfaceElevated: '#1A222B',
  surfaceMuted: '#1E2731',
  border: '#232D38',
  borderStrong: '#34404D',
  text: '#F1F5F9',
  textSecondary: '#A7B3C2',
  textMuted: '#6B7A8C',
  primary: '#F1F5F9',
  primaryHover: '#E2E8F0',
  onPrimary: '#0B0F14',
  primarySoft: '#243040',
  income: '#4ADE80',
  incomeSoft: '#0F2A1C',
  expense: '#F87171',
  expenseSoft: '#2F1414',
  warning: '#FBBF24',
  warningSoft: '#2D2309',
  info: '#60A5FA',
  infoSoft: '#0F2140',
  overlay: 'rgba(0, 0, 0, 0.6)',
  skeleton: '#1E2731',
  focusRing: '#60A5FA',
};

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
} as const;

export type TypographyVariant =
  | 'display'
  | 'title'
  | 'heading'
  | 'subheading'
  | 'body'
  | 'bodyStrong'
  | 'caption'
  | 'label'
  | 'mono';

const fontFamilyMono = Platform.select({
  web: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  default: 'monospace',
});

export const typography: Record<TypographyVariant, TextStyle> = {
  display: { fontSize: 32, lineHeight: 38, fontWeight: '700', letterSpacing: -0.5 },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '700', letterSpacing: -0.3 },
  heading: { fontSize: 18, lineHeight: 24, fontWeight: '600' },
  subheading: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' },
  bodyStrong: { fontSize: 15, lineHeight: 22, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  label: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  mono: { fontSize: 14, lineHeight: 20, fontFamily: fontFamilyMono },
};

/** Subtle elevation that renders consistently on web (box-shadow) and Android (elevation). */
export function cardShadow(scheme: ColorScheme): ViewStyle {
  if (Platform.OS === 'web') {
    return {
      boxShadow: scheme === 'dark' ? '0 1px 2px rgba(0,0,0,0.4)' : '0 1px 2px rgba(15,23,42,0.06)',
    };
  }
  return scheme === 'dark'
    ? { elevation: 0 }
    : {
        elevation: 1,
        shadowColor: '#0F172A',
        shadowOpacity: 0.05,
        shadowRadius: 2,
        shadowOffset: { width: 0, height: 1 },
      };
}

export const breakpoints = {
  tablet: 768,
  desktop: 1024,
  contentMaxWidth: 1120,
  sidebarWidth: 240,
} as const;

/** Chart colours validated for colour-vision separation on each surface (see dataviz palette). */
export interface ChartColors {
  income: string;
  expense: string;
  /** Fixed categorical order; never cycle past the list — fold into `other`. */
  categorical: string[];
  other: string;
  grid: string;
  axis: string;
}

export function chartColors(scheme: ColorScheme): ChartColors {
  return scheme === 'dark'
    ? {
        income: '#4ADE80',
        expense: '#DC2626',
        categorical: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#9085e9'],
        other: '#6B7A8C',
        grid: '#232D38',
        axis: '#34404D',
      }
    : {
        income: '#15803D',
        expense: '#F87171',
        categorical: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#4a3aa7'],
        other: '#94A3B8',
        grid: '#E4E7EB',
        axis: '#CBD2DA',
      };
}
