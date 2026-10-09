import { ArrowLeftRight, Tag, Trash2, X } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useInteractionState } from '@/hooks/useInteractionState';
import { useT } from '@/i18n';
import { useTheme } from '@/theme';
import type { LucideIcon } from 'lucide-react-native';

export interface BulkActionBarProps {
  count: number;
  onCategory: () => void;
  onType: () => void;
  onDelete: () => void;
  onCancel: () => void;
  /** Distance from the bottom edge (safe-area + tab bar). */
  bottom: number;
}

/** Floating bar shown while transactions are selected: category · income/expense · delete. */
export function BulkActionBar({
  count,
  onCategory,
  onType,
  onDelete,
  onCancel,
  bottom,
}: BulkActionBarProps) {
  const theme = useTheme();
  const t = useT();
  const { isMobile } = useBreakpoint();
  const disabled = count === 0;
  return (
    <View
      pointerEvents="box-none"
      style={[styles.host, { bottom, paddingHorizontal: isMobile ? 12 : 24 }]}
    >
      <View
        accessibilityRole="toolbar"
        style={[
          styles.bar,
          {
            backgroundColor: theme.colors.primary,
            borderRadius: theme.radii.xl,
            shadowColor: '#000',
          },
        ]}
      >
        <Pressable
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel={t('tx.bulk.cancel')}
          hitSlop={8}
          style={styles.close}
        >
          <X size={18} color={theme.colors.onPrimary} />
        </Pressable>
        <Text
          variant="bodyStrong"
          style={{ color: theme.colors.onPrimary, flex: 1, minWidth: 0 }}
          numberOfLines={1}
        >
          {t('tx.selectedCount', { count })}
        </Text>
        <Action
          icon={Tag}
          label={t('tx.bulk.category')}
          onPress={onCategory}
          disabled={disabled}
          compact={isMobile}
        />
        <Action
          icon={ArrowLeftRight}
          label={t('tx.bulk.type')}
          onPress={onType}
          disabled={disabled}
          compact={isMobile}
        />
        <Action
          icon={Trash2}
          label={t('tx.bulk.delete')}
          onPress={onDelete}
          disabled={disabled}
          compact={isMobile}
          danger
        />
      </View>
    </View>
  );
}

function Action({
  icon: Icon,
  label,
  onPress,
  disabled,
  compact,
  danger = false,
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  disabled: boolean;
  compact: boolean;
  danger?: boolean;
}) {
  const theme = useTheme();
  const { hovered, pressed, handlers } = useInteractionState();
  const color = danger ? '#FCA5A5' : theme.colors.onPrimary;
  return (
    <Pressable
      {...handlers}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={[
        styles.action,
        { borderRadius: theme.radii.md, opacity: disabled ? 0.5 : 1 },
        hovered || pressed ? { backgroundColor: 'rgba(255,255,255,0.14)' } : null,
      ]}
    >
      <Icon size={18} color={color} />
      {compact ? null : (
        <Text variant="caption" style={{ color, fontWeight: '600' }}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 10,
    paddingRight: 6,
    paddingVertical: 6,
    width: '100%',
    maxWidth: 640,
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  close: { padding: 6 },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
});
