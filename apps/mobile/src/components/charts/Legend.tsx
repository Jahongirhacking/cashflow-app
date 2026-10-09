import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/Text';

export interface LegendItem {
  label: string;
  color: string;
  value?: string;
}

export function Legend({ items }: { items: LegendItem[] }) {
  return (
    <View style={styles.root} accessibilityRole="list">
      {items.map((item) => (
        <View key={item.label} style={styles.item}>
          <View style={[styles.swatch, { backgroundColor: item.color }]} />
          <Text variant="caption" color="textSecondary">
            {item.label}
            {item.value ? ` · ${item.value}` : ''}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 10, height: 10, borderRadius: 3 },
});
