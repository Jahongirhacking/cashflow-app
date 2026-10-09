import { addDays, daysInMonth, parseIsoDate, shiftMonthKey, todayIsoDate } from '@finance/shared';
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Text } from '@/components/ui/Text';
import { useInteractionState } from '@/hooks/useInteractionState';
import { monthLong, useLocale, useT, weekdayShort } from '@/i18n';
import { useTheme } from '@/theme';

export interface DateFieldProps {
  label?: string;
  /** ISO date (YYYY-MM-DD) or '' when empty. */
  value: string;
  onChange: (iso: string) => void;
  error?: string;
  hint?: string;
  placeholder?: string;
  /** Show a clear action (optional dates such as "ends on"). */
  allowClear?: boolean;
  /** Earliest / latest selectable dates (ISO). */
  min?: string;
  max?: string;
  accessibilityLabel?: string;
}

const WEEK_START = 1; // Monday, as in Uzbekistan

/** Formats an ISO date in the current locale: "7 Oct 2026". */
function formatLong(iso: string, locale: string): string {
  const d = parseIsoDate(iso);
  return `${d.getDate()} ${monthLong(locale as 'uz' | 'en')[d.getMonth()]?.slice(0, 3) ?? ''} ${d.getFullYear()}`;
}

/** Field that opens a calendar dialog instead of asking for a typed date. */
export function DateField({
  label,
  value,
  onChange,
  error,
  hint,
  placeholder,
  allowClear = false,
  min,
  max,
  accessibilityLabel,
}: DateFieldProps) {
  const theme = useTheme();
  const t = useT();
  const { locale } = useLocale();
  const [open, setOpen] = useState(false);
  const { hovered, pressed, handlers } = useInteractionState();
  const display = value ? formatLong(value, locale) : (placeholder ?? t('date.pick'));

  return (
    <View style={{ gap: 6 }}>
      {label ? (
        <Text variant="caption" color="textSecondary" style={{ fontWeight: '600' }}>
          {label}
        </Text>
      ) : null}
      {/* The clear control sits beside the opener, not inside it: nested buttons are invalid on web. */}
      <View
        style={[
          styles.field,
          {
            borderColor: error ? theme.colors.expense : theme.colors.borderStrong,
            borderRadius: theme.radii.md,
            backgroundColor: hovered || pressed ? theme.colors.surfaceMuted : theme.colors.surface,
          },
        ]}
      >
        <Pressable
          {...handlers}
          onPress={() => setOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`${accessibilityLabel ?? label ?? t('date.pick')}: ${value || t('date.none')}`}
          style={styles.opener}
        >
          <CalendarDays size={18} color={theme.colors.textSecondary} />
          <Text
            variant="body"
            color={value ? 'text' : 'textMuted'}
            style={{ flex: 1, minWidth: 0 }}
            numberOfLines={1}
          >
            {display}
          </Text>
        </Pressable>
        {allowClear && value ? (
          <Pressable
            onPress={() => onChange('')}
            accessibilityRole="button"
            accessibilityLabel={t('date.clear')}
            hitSlop={8}
            style={styles.clear}
          >
            <X size={16} color={theme.colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text variant="caption" color="expense" accessibilityRole="alert">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" color="textMuted">
          {hint}
        </Text>
      ) : null}
      <CalendarDialog
        visible={open}
        value={value}
        min={min}
        max={max}
        title={label ?? t('date.pick')}
        onClose={() => setOpen(false)}
        onPick={(iso) => {
          onChange(iso);
          setOpen(false);
        }}
      />
    </View>
  );
}

interface CalendarDialogProps {
  visible: boolean;
  value: string;
  min?: string;
  max?: string;
  title: string;
  onClose: () => void;
  onPick: (iso: string) => void;
}

/** Month grid with quick "today / yesterday" actions. All dates are plain ISO strings; no time zones involved. */
export function CalendarDialog({
  visible,
  value,
  min,
  max,
  title,
  onClose,
  onPick,
}: CalendarDialogProps) {
  const theme = useTheme();
  const t = useT();
  const { locale } = useLocale();
  const today = todayIsoDate();
  const [month, setMonth] = useState(() => (value || today).slice(0, 7));
  const [cursor, setCursor] = useState(value || today);
  // Re-open on the selected date when the value changed while closed.
  const [seenValue, setSeenValue] = useState(value);
  if (seenValue !== value) {
    setSeenValue(value);
    setMonth((value || today).slice(0, 7));
    setCursor(value || today);
  }

  const weekdays = useMemo(() => {
    const names = weekdayShort(locale);
    // Dictionaries list Sunday first (JS order); rotate so the week starts on Monday.
    return names.map((_, i) => names[(i + WEEK_START) % 7] ?? '');
  }, [locale]);

  const cells = useMemo(() => {
    const [y, m] = month.split('-').map(Number);
    const first = new Date(y ?? 1970, (m ?? 1) - 1, 1);
    const lead = (first.getDay() - WEEK_START + 7) % 7;
    const count = daysInMonth(month);
    const out: (string | null)[] = [];
    for (let i = 0; i < lead; i += 1) out.push(null);
    for (let d = 1; d <= count; d += 1) out.push(`${month}-${String(d).padStart(2, '0')}`);
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [month]);

  const [y, m] = month.split('-').map(Number);
  const monthTitle = `${monthLong(locale)[(m ?? 1) - 1] ?? ''} ${y ?? ''}`;
  const disabled = (iso: string) =>
    (min !== undefined && iso < min) || (max !== undefined && iso > max);

  return (
    <Dialog
      visible={visible}
      title={title}
      onClose={onClose}
      maxWidth={380}
      footer={
        <>
          <Button title={t('common.cancel')} variant="ghost" onPress={onClose} />
          <Button
            title={t('common.done')}
            onPress={() => onPick(cursor)}
            disabled={!cursor || disabled(cursor)}
          />
        </>
      }
    >
      <View style={styles.monthRow}>
        <Pressable
          onPress={() => setMonth((k) => shiftMonthKey(k, -1))}
          accessibilityRole="button"
          accessibilityLabel={t('date.prevMonth')}
          hitSlop={8}
          style={[styles.navButton, { borderRadius: theme.radii.full }]}
        >
          <ChevronLeft size={20} color={theme.colors.text} />
        </Pressable>
        <Text variant="bodyStrong" style={{ flex: 1, textAlign: 'center' }}>
          {monthTitle}
        </Text>
        <Pressable
          onPress={() => setMonth((k) => shiftMonthKey(k, 1))}
          accessibilityRole="button"
          accessibilityLabel={t('date.nextMonth')}
          hitSlop={8}
          style={[styles.navButton, { borderRadius: theme.radii.full }]}
        >
          <ChevronRight size={20} color={theme.colors.text} />
        </Pressable>
      </View>
      <View style={styles.grid}>
        {weekdays.map((w) => (
          <View key={w} style={styles.cell}>
            <Text variant="caption" color="textMuted" style={{ fontWeight: '600' }}>
              {w}
            </Text>
          </View>
        ))}
        {cells.map((iso, i) => {
          if (!iso) return <View key={`e-${i}`} style={styles.cell} />;
          const selected = iso === cursor;
          const isToday = iso === today;
          const off = disabled(iso);
          return (
            <Pressable
              key={iso}
              onPress={() => setCursor(iso)}
              disabled={off}
              accessibilityRole="button"
              accessibilityLabel={formatLong(iso, locale)}
              accessibilityState={{ selected, disabled: off }}
              style={styles.cell}
            >
              <View
                style={[
                  styles.day,
                  {
                    borderRadius: theme.radii.full,
                    backgroundColor: selected ? theme.colors.primary : 'transparent',
                    borderWidth: isToday && !selected ? 1 : 0,
                    borderColor: theme.colors.primary,
                    opacity: off ? 0.35 : 1,
                  },
                ]}
              >
                <Text
                  variant="body"
                  style={{
                    color: selected ? theme.colors.onPrimary : theme.colors.text,
                    fontWeight: selected || isToday ? '700' : '400',
                  }}
                >
                  {Number(iso.slice(8, 10))}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.quick}>
        <Button
          title={t('common.today')}
          variant="secondary"
          size="sm"
          onPress={() => {
            setMonth(today.slice(0, 7));
            setCursor(today);
          }}
          disabled={disabled(today)}
        />
        <Button
          title={t('common.yesterday')}
          variant="secondary"
          size="sm"
          onPress={() => {
            const y1 = addDays(today, -1);
            setMonth(y1.slice(0, 7));
            setCursor(y1);
          }}
          disabled={disabled(addDays(today, -1))}
        />
      </View>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    minHeight: 46,
    minWidth: 0,
    overflow: 'hidden',
  },
  opener: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    minHeight: 44,
  },
  clear: { paddingHorizontal: 12, alignSelf: 'stretch', justifyContent: 'center' },
  monthRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  navButton: { padding: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '14.2857%', alignItems: 'center', justifyContent: 'center', paddingVertical: 2 },
  day: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  quick: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
});
