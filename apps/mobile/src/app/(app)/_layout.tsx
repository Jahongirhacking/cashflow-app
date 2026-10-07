import { Tabs, usePathname } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { hiddenTabRoutes, tabItems } from '@/components/navigation/routes';
import { Sidebar } from '@/components/navigation/Sidebar';
import { AccessLostScreen } from '@/features/spreadsheet/components/AccessLostScreen';
import { useSpreadsheetAccess } from '@/features/spreadsheet/SpreadsheetAccessProvider';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useTheme } from '@/theme';

/**
 * Adaptive shell: bottom tabs on phones/tablets, persistent sidebar on desktop.
 * Both render the same route tree so deep links work identically everywhere.
 */
export default function AppLayout() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { isDesktop } = useBreakpoint();
  const tabBarHeight = 58 + insets.bottom;
  const { accessLost } = useSpreadsheetAccess();
  const pathname = usePathname();
  const showAccessLost = accessLost && !pathname.startsWith('/settings');

  return (
    <View style={[styles.row, { backgroundColor: theme.colors.background }]}>
      {isDesktop ? <Sidebar /> : null}
      <View style={styles.content}>
        {showAccessLost ? <AccessLostScreen /> : null}
        <View style={[styles.content, showAccessLost ? styles.hidden : null]}>
          <Tabs
            screenOptions={{
              headerShown: false,
              sceneStyle: { backgroundColor: theme.colors.background },
              tabBarStyle: isDesktop
                ? { display: 'none' }
                : {
                    backgroundColor: theme.colors.surface,
                    borderTopColor: theme.colors.border,
                    borderTopWidth: 1,
                    elevation: 0,
                    height: tabBarHeight,
                    paddingBottom: insets.bottom,
                    paddingTop: 6,
                  },
              tabBarItemStyle: { paddingHorizontal: 0 },
              tabBarActiveTintColor: theme.colors.text,
              tabBarInactiveTintColor: theme.colors.textMuted,
              tabBarLabelStyle: { fontSize: 10, fontWeight: '600', marginTop: 2 },
            }}
          >
            {tabItems.map((item) => {
              const Icon = item.icon;
              return (
                <Tabs.Screen
                  key={item.name}
                  name={item.name}
                  options={{
                    title: item.title,
                    tabBarAccessibilityLabel: item.title,
                    tabBarIcon: ({ color, size }) => (
                      <Icon color={color} size={size - 2} strokeWidth={2} />
                    ),
                  }}
                />
              );
            })}
            {hiddenTabRoutes.map((name) => (
              <Tabs.Screen key={name} name={name} options={{ href: null }} />
            ))}
          </Tabs>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flex: 1, flexDirection: 'row' },
  content: { flex: 1, minWidth: 0 },
  hidden: { display: 'none' },
});
