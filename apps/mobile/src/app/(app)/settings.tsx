import { LogOut, Moon, Sun, SunMoon } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { useAuth } from '@/features/auth/AuthProvider';
import { SpreadsheetSettingsCard } from '@/features/spreadsheet/components/SpreadsheetSettingsCard';
import { type ThemeMode, useTheme, useThemeMode } from '@/theme';

const THEME_OPTIONS: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: SunMoon },
];

export default function SettingsScreen() {
  const theme = useTheme();
  const auth = useAuth();
  const { mode, setMode } = useThemeMode();

  return (
    <Screen title="Settings">
      <SectionLabel>Account</SectionLabel>
      <Card>
        {auth.user ? (
          <View style={styles.accountRow}>
            <Avatar name={auth.user.name} uri={auth.user.picture} size={44} />
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">{auth.user.name}</Text>
              <Text variant="caption" color="textSecondary">
                {auth.user.email}
              </Text>
            </View>
            <Button
              title="Sign out"
              variant="secondary"
              size="sm"
              icon={LogOut}
              onPress={() => void auth.signOut()}
            />
          </View>
        ) : null}
      </Card>

      <SectionLabel style={{ marginTop: theme.spacing.xl }}>Spreadsheet</SectionLabel>
      <SpreadsheetSettingsCard />

      <SectionLabel style={{ marginTop: theme.spacing.xl }}>Appearance</SectionLabel>
      <Card padding="none">
        {THEME_OPTIONS.map((option, index) => {
          const Icon = option.icon;
          const selected = mode === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => setMode(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={`${option.label} theme`}
              style={({ pressed }) => [
                styles.row,
                index > 0 ? { borderTopWidth: 1, borderTopColor: theme.colors.border } : null,
                pressed ? { backgroundColor: theme.colors.surfaceMuted } : null,
              ]}
            >
              <View style={styles.rowLeft}>
                <Icon size={18} color={theme.colors.textSecondary} />
                <Text variant="body">{option.label}</Text>
              </View>
              <View
                style={[
                  styles.radio,
                  { borderColor: selected ? theme.colors.text : theme.colors.borderStrong },
                  selected ? { backgroundColor: theme.colors.text } : null,
                ]}
              />
            </Pressable>
          );
        })}
      </Card>
    </Screen>
  );
}

function SectionLabel({ children, style }: { children: string; style?: object }) {
  const theme = useTheme();
  return (
    <Text variant="label" color="textMuted" style={[{ marginBottom: theme.spacing.sm }, style]}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  accountRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2 },
});
