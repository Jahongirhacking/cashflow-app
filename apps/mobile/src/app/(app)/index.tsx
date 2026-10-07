import { StyleSheet, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { SystemStatusCard } from '@/features/dashboard/components/SystemStatusCard';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useTheme } from '@/theme';

export default function DashboardScreen() {
  const theme = useTheme();
  const { isDesktop } = useBreakpoint();

  return (
    <Screen title="Dashboard" subtitle="Your finances at a glance">
      <View style={[styles.grid, isDesktop ? styles.gridDesktop : null, { gap: theme.spacing.lg }]}>
        <View style={isDesktop ? styles.gridItemDesktop : null}>
          <SystemStatusCard />
        </View>
        <View style={isDesktop ? styles.gridItemDesktop : null}>
          <Card>
            <Text variant="label" color="textMuted">
              Getting started
            </Text>
            <Text variant="subheading" style={{ marginTop: theme.spacing.md }}>
              Sign in and connect your spreadsheet
            </Text>
            <Text variant="caption" color="textSecondary" style={{ marginTop: theme.spacing.xs }}>
              Balances, transactions and analytics appear here once your Google Spreadsheet is
              connected.
            </Text>
          </Card>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'column' },
  gridDesktop: { flexDirection: 'row', flexWrap: 'wrap' },
  gridItemDesktop: { flexGrow: 1, flexBasis: 320, minWidth: 0 },
});
