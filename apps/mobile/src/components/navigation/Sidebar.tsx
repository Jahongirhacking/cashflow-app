import { Link, usePathname } from 'expo-router';
import { Moon, Sun, SunMoon } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { Avatar } from '@/components/ui/Avatar';
import { Text } from '@/components/ui/Text';
import { useAuth } from '@/features/auth/AuthProvider';
import { useT } from '@/i18n';
import { useInteractionState } from '@/hooks/useInteractionState';
import { breakpoints, useTheme, useThemeMode } from '@/theme';
import { type NavItem, sidebarItems } from './routes';

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar() {
  const theme = useTheme();
  const pathname = usePathname();

  return (
    <View
      style={[
        styles.root,
        {
          width: breakpoints.sidebarWidth,
          backgroundColor: theme.colors.surface,
          borderRightColor: theme.colors.border,
        },
      ]}
      accessibilityRole="menu"
    >
      <View style={[styles.brand, { paddingHorizontal: theme.spacing.lg }]}>
        <View
          style={[
            styles.logo,
            { backgroundColor: theme.colors.primary, borderRadius: theme.radii.sm },
          ]}
        >
          <Text variant="bodyStrong" color="onPrimary">
            F
          </Text>
        </View>
        <Text variant="heading">Finance</Text>
      </View>

      <View style={[styles.nav, { paddingHorizontal: theme.spacing.sm }]}>
        {sidebarItems.map((item) => (
          <SidebarLink key={item.name} item={item} active={isActive(pathname, item.href)} />
        ))}
      </View>

      <View
        style={{
          padding: theme.spacing.sm,
          borderTopWidth: 1,
          borderTopColor: theme.colors.border,
          gap: 8,
        }}
      >
        <UserChip />
        <ThemeModeSwitch />
      </View>
    </View>
  );
}

function SidebarLink({ item, active }: { item: NavItem; active: boolean }) {
  const theme = useTheme();
  const t = useT();
  const title = t(item.titleKey);
  const { hovered, pressed, handlers } = useInteractionState();
  const Icon = item.icon;
  return (
    <Link href={item.href} asChild>
      <Pressable
        {...handlers}
        accessibilityRole="link"
        accessibilityLabel={title}
        accessibilityState={{ selected: active }}
        style={StyleSheet.flatten([
          styles.link,
          { borderRadius: theme.radii.md },
          active ? { backgroundColor: theme.colors.primarySoft } : null,
          !active && (hovered || pressed) ? { backgroundColor: theme.colors.surfaceMuted } : null,
        ])}
      >
        <Icon
          size={18}
          color={active ? theme.colors.text : theme.colors.textSecondary}
          strokeWidth={2}
        />
        <Text variant={active ? 'bodyStrong' : 'body'} color={active ? 'text' : 'textSecondary'}>
          {title}
        </Text>
      </Pressable>
    </Link>
  );
}

function UserChip() {
  const theme = useTheme();
  const t = useT();
  const { user } = useAuth();
  if (!user) return null;
  return (
    <Link href="/settings" asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={t('nav.accountSettings')}
        style={StyleSheet.flatten([styles.userChip, { borderRadius: theme.radii.md }])}
      >
        <Avatar name={user.name} uri={user.picture} size={28} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="caption" numberOfLines={1} style={{ fontWeight: '600' }}>
            {user.name}
          </Text>
          <Text variant="caption" color="textMuted" numberOfLines={1}>
            {user.email}
          </Text>
        </View>
      </Pressable>
    </Link>
  );
}

function ThemeModeSwitch() {
  const theme = useTheme();
  const t = useT();
  const { mode, setMode } = useThemeMode();
  const options = [
    { value: 'light', icon: Sun, label: t('theme.lightTheme') },
    { value: 'system', icon: SunMoon, label: t('theme.systemTheme') },
    { value: 'dark', icon: Moon, label: t('theme.darkTheme') },
  ] as const;

  return (
    <View
      style={[
        styles.segmented,
        { backgroundColor: theme.colors.surfaceMuted, borderRadius: theme.radii.md },
      ]}
    >
      {options.map(({ value, icon: Icon, label }) => {
        const selected = mode === value;
        return (
          <Pressable
            key={value}
            onPress={() => setMode(value)}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected }}
            style={[
              styles.segment,
              { borderRadius: theme.radii.sm },
              selected ? { backgroundColor: theme.colors.surface } : null,
            ]}
          >
            <Icon size={16} color={selected ? theme.colors.text : theme.colors.textMuted} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { borderRightWidth: 1, height: '100%' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 64 },
  logo: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  nav: { flex: 1, gap: 2, paddingTop: 8 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, height: 40 },
  userChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  segmented: { flexDirection: 'row', padding: 3, gap: 2 },
  segment: { flex: 1, height: 30, alignItems: 'center', justifyContent: 'center' },
});
