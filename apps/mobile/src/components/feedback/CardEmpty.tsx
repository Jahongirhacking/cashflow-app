import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme';

/** Compact placeholder for a card with nothing to show yet: an icon in a soft circle plus one line. */
export function CardEmpty({
  icon: Icon,
  message,
  action,
}: {
  icon: LucideIcon;
  message: string;
  action?: React.ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={styles.root}>
      <View
        style={[
          styles.icon,
          { backgroundColor: theme.colors.surfaceMuted, borderRadius: theme.radii.full },
        ]}
      >
        <Icon size={18} color={theme.colors.textMuted} />
      </View>
      <Text variant="caption" color="textMuted" align="center" style={{ maxWidth: 260 }}>
        {message}
      </Text>
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, flex: 1 },
  icon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  action: { flexDirection: 'row', justifyContent: 'center', alignSelf: 'stretch' },
});
