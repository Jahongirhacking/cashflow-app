import { Link } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { type NavItem, moreItems } from '@/components/navigation/routes';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { useInteractionState } from '@/hooks/useInteractionState';
import { useTheme } from '@/theme';

export default function MoreScreen() {
  return (
    <Screen title="More">
      <Card padding="none">
        {moreItems.map((item, index) => (
          <MoreRow key={item.name} item={item} first={index === 0} />
        ))}
      </Card>
    </Screen>
  );
}

function MoreRow({ item, first }: { item: NavItem; first: boolean }) {
  const theme = useTheme();
  const { hovered, pressed, handlers } = useInteractionState();
  const Icon = item.icon;
  return (
    <Link href={item.href} asChild>
      <Pressable
        {...handlers}
        accessibilityRole="link"
        accessibilityLabel={item.title}
        style={StyleSheet.flatten([
          styles.row,
          first ? null : { borderTopWidth: 1, borderTopColor: theme.colors.border },
          hovered || pressed ? { backgroundColor: theme.colors.surfaceMuted } : null,
        ])}
      >
        <View style={styles.rowLeft}>
          <Icon size={18} color={theme.colors.textSecondary} />
          <Text variant="body">{item.title}</Text>
        </View>
        <ChevronRight size={18} color={theme.colors.textMuted} />
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
