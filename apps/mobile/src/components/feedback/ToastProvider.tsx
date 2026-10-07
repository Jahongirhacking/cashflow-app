import { CheckCircle2, CircleAlert, Info, X } from 'lucide-react-native';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { cardShadow, useTheme } from '@/theme';
import { Text } from '@/components/ui/Text';

export type ToastTone = 'success' | 'error' | 'info';

export interface ToastOptions {
  message: string;
  tone?: ToastTone;
  /** Optional action, e.g. Retry. */
  action?: { label: string; onPress: () => void };
  durationMs?: number;
}

interface ToastItem extends ToastOptions {
  id: number;
  tone: ToastTone;
}

interface ToastContextValue {
  show: (options: ToastOptions) => void;
  success: (message: string) => void;
  error: (message: string, action?: ToastOptions['action']) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback(
    (id: number) => setToasts((list) => list.filter((t) => t.id !== id)),
    [],
  );

  const show = useCallback(
    (options: ToastOptions) => {
      const id = (counter.current += 1);
      const item: ToastItem = { ...options, id, tone: options.tone ?? 'info' };
      setToasts((list) => [...list.slice(-2), item]);
      const duration = options.durationMs ?? (options.tone === 'error' ? 6000 : 3500);
      setTimeout(() => dismiss(id), duration);
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      show,
      success: (message) => show({ message, tone: 'success' }),
      error: (message, action) => show({ message, tone: 'error', action }),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { isDesktop } = useBreakpoint();
  if (toasts.length === 0) return null;
  const position = isDesktop
    ? { top: theme.spacing.lg, right: theme.spacing.lg, alignItems: 'flex-end' as const }
    : {
        bottom: 72 + insets.bottom,
        left: theme.spacing.lg,
        right: theme.spacing.lg,
        alignItems: 'stretch' as const,
      };
  return (
    <View pointerEvents="box-none" style={[styles.viewport, position]}>
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onDismiss={() => onDismiss(toast.id)} />
      ))}
    </View>
  );
}

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const theme = useTheme();
  const Icon =
    toast.tone === 'success' ? CheckCircle2 : toast.tone === 'error' ? CircleAlert : Info;
  const color =
    toast.tone === 'success'
      ? theme.colors.income
      : toast.tone === 'error'
        ? theme.colors.expense
        : theme.colors.info;
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surfaceElevated,
          borderColor: theme.colors.border,
          borderRadius: theme.radii.md,
        },
        cardShadow(theme.scheme),
        Platform.OS === 'web' ? { maxWidth: 420 } : null,
      ]}
    >
      <Icon size={18} color={color} />
      <Text variant="caption" style={{ flex: 1 }}>
        {toast.message}
      </Text>
      {toast.action ? (
        <Pressable
          onPress={() => {
            toast.action?.onPress();
            onDismiss();
          }}
          accessibilityRole="button"
          accessibilityLabel={toast.action.label}
          hitSlop={8}
        >
          <Text variant="caption" style={{ fontWeight: '700' }}>
            {toast.action.label}
          </Text>
        </Pressable>
      ) : null}
      <Pressable
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
        hitSlop={8}
      >
        <X size={16} color={theme.colors.textMuted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: { position: 'absolute', gap: 8, zIndex: 100 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
  },
});
