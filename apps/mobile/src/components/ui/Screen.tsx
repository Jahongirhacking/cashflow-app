import { useBreakpoint } from '@/hooks/useBreakpoint';
import { breakpoints, useTheme } from '@/theme';
import { useCallback, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { RefreshControl } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from './Text';

export interface ScreenProps {
  title?: string;
  subtitle?: string;
  /** Rendered on the right of the title row (actions, filters). */
  headerRight?: ReactNode;
  children: ReactNode;
  scroll?: boolean;
  contentStyle?: ViewStyle;
  onRefresh?: () => Promise<void> | void;
}

/**
 * Page container: safe-area aware, scrollable, and centred with a max width on desktop
 * so content is never stretched edge-to-edge on wide screens.
 */
export function Screen({
  title,
  subtitle,
  headerRight,
  children,
  scroll = true,
  contentStyle,
  onRefresh,
}: ScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { isDesktop, isMobile } = useBreakpoint();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    if (!onRefresh || refreshing) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } catch (error) {
      console.error('Screen refresh failed:', error);
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh, refreshing]);

  const horizontalPadding = isMobile ? theme.spacing.lg : theme.spacing.xxl;

  const header =
    title || headerRight ? (
      <View style={[styles.header, { marginBottom: theme.spacing.xl }]}>
        <View style={styles.headerText}>
          {title ? (
            <Text variant="title" accessibilityRole="header">
              {title}
            </Text>
          ) : null}
          {subtitle ? (
            <Text variant="caption" color="textSecondary" style={{ marginTop: theme.spacing.xs }}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {headerRight}
      </View>
    ) : null;

  const content = (
    <View
      style={[
        styles.content,
        {
          paddingHorizontal: horizontalPadding,
          paddingTop: isDesktop ? theme.spacing.xxl : theme.spacing.lg + insets.top,
          paddingBottom: theme.spacing.xxl,
          maxWidth: breakpoints.contentMaxWidth,
        },
        contentStyle,
      ]}
    >
      {header}
      {children}
    </View>
  );

  if (!scroll) {
    return (
      <View style={[styles.root, { backgroundColor: theme.colors.background }]}>{content}</View>
    );
  }

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        ) : undefined
      }
    >
      {content}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  content: { width: '100%', alignSelf: 'center', flexGrow: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerText: { flex: 1 },
});
