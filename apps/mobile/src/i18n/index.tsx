import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';
import { en, type TranslationKey } from './en';
import { uz } from './uz';

export type Locale = 'uz' | 'en';
export const LOCALES: Locale[] = ['uz', 'en'];
export const DEFAULT_LOCALE: Locale = 'uz';
const STORAGE_KEY = 'finance.locale';
const dictionaries: Record<Locale, Record<TranslationKey, string>> = { en, uz };

export type TranslateParams = Record<string, string | number>;

/**
 * Tiny module-level store so non-React helpers (date labels, frequency text) read the
 * current locale, while components subscribe through the provider below.
 */
let currentLocale: Locale = DEFAULT_LOCALE;
const listeners = new Set<() => void>();

export function getLocale(): Locale {
  return currentLocale;
}

function setCurrentLocale(locale: Locale): void {
  if (locale === currentLocale) return;
  currentLocale = locale;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function interpolate(template: string, params?: TranslateParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    params[key] === undefined ? `{${key}}` : String(params[key]),
  );
}

/** Translate outside React (uses the current locale). */
export function translate(
  key: TranslationKey,
  params?: TranslateParams,
  locale: Locale = currentLocale,
): string {
  const text = dictionaries[locale][key] ?? dictionaries.en[key] ?? key;
  return interpolate(text, params);
}

export function monthShort(locale: Locale = currentLocale): string[] {
  return translate('month.short', undefined, locale).split(',');
}
export function monthLong(locale: Locale = currentLocale): string[] {
  return translate('month.long', undefined, locale).split(',');
}
export function weekdayShort(locale: Locale = currentLocale): string[] {
  return translate('weekday.short', undefined, locale).split(',');
}
export function weekdayLong(locale: Locale = currentLocale): string[] {
  return translate('weekday.long', undefined, locale).split(',');
}

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  isReady: boolean;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const locale = useSyncExternalStore(subscribe, getLocale, getLocale);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (!cancelled && (stored === 'uz' || stored === 'en')) setCurrentLocale(stored);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setIsReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setCurrentLocale(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
  }, []);

  const value = useMemo(() => ({ locale, setLocale, isReady }), [locale, setLocale, isReady]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export type Translate = (key: TranslationKey, params?: TranslateParams) => string;

/** `t('tx.count', { count })` — re-renders when the locale changes. */
export function useT(): Translate {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useT must be used within I18nProvider');
  const { locale } = ctx;
  return useCallback(
    (key: TranslationKey, params?: TranslateParams) => translate(key, params, locale),
    [locale],
  );
}

export function useLocale(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useLocale must be used within I18nProvider');
  return ctx;
}

export type { TranslationKey };
