import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme';
import { Text } from '@/components/ui/Text';

export function FullScreenLoader({ label }: { label?: string }) {
  const theme = useTheme();
  return (
    <View
      style={[styles.root, { backgroundColor: theme.colors.background }]}
      accessibilityRole="progressbar"
    >
      <ActivityIndicator color={theme.colors.textSecondary} />
      {label ? (
        <Text variant="caption" color="textSecondary" style={{ marginTop: theme.spacing.md }}>
          {label}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
