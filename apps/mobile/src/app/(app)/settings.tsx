import { Globe, LogOut, Moon, Sun, SunMoon } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { useAuth } from '@/features/auth/AuthProvider';
import { SpreadsheetSettingsCard } from '@/features/spreadsheet/components/SpreadsheetSettingsCard';
import { ExportCard } from '@/features/transactions/export/ExportCard';
import { ImportCard } from '@/features/transactions/import/ImportCard';
import { type Locale, LOCALES, useLocale, useT } from '@/i18n';
import { type ThemeMode, useTheme, useThemeMode } from '@/theme';

export default function SettingsScreen() {
  const theme = useTheme();
  const t = useT();
  const auth = useAuth();
  const { mode, setMode } = useThemeMode();
  const { locale, setLocale } = useLocale();

  const themeOptions: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
    { value: 'light', label: t('theme.light'), icon: Sun },
    { value: 'dark', label: t('theme.dark'), icon: Moon },
    { value: 'system', label: t('theme.system'), icon: SunMoon },
  ];
  const languageOptions: { value: Locale; label: string }[] = LOCALES.map((value) => ({
    value,
    label: value === 'uz' ? t('language.uz') : t('language.en'),
  }));

  return (
    <Screen title={t('settings.title')}>
      <SectionLabel>{t('settings.account')}</SectionLabel>
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
              title={t('common.signOut')}
              variant="secondary"
              size="sm"
              icon={LogOut}
              onPress={() => void auth.signOut()}
            />
          </View>
        ) : null}
      </Card>

      <SectionLabel style={{ marginTop: theme.spacing.xl }}>{t('language.title')}</SectionLabel>
      <Card padding="none">
        {languageOptions.map((option, index) => (
          <OptionRow
            key={option.value}
            icon={Globe}
            label={option.label}
            selected={locale === option.value}
            first={index === 0}
            accessibilityLabel={option.label}
            onPress={() => setLocale(option.value)}
          />
        ))}
      </Card>

      <SectionLabel style={{ marginTop: theme.spacing.xl }}>
        {t('settings.spreadsheet')}
      </SectionLabel>
      <SpreadsheetSettingsCard />

      <SectionLabel style={{ marginTop: theme.spacing.xl }}>{t('settings.data')}</SectionLabel>
      <View style={{ gap: theme.spacing.md }}>
        <ExportCard />
        <ImportCard />
      </View>

      <SectionLabel style={{ marginTop: theme.spacing.xl }}>
        {t('settings.appearance')}
      </SectionLabel>
      <Card padding="none">
        {themeOptions.map((option, index) => (
          <OptionRow
            key={option.value}
            icon={option.icon}
            label={option.label}
            selected={mode === option.value}
            first={index === 0}
            accessibilityLabel={option.label}
            onPress={() => setMode(option.value)}
          />
        ))}
      </Card>
    </Screen>
  );
}

function OptionRow({
  icon: Icon,
  label,
  selected,
  first,
  accessibilityLabel,
  onPress,
}: {
  icon: typeof Sun;
  label: string;
  selected: boolean;
  first: boolean;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.row,
        first ? null : { borderTopWidth: 1, borderTopColor: theme.colors.border },
        pressed ? { backgroundColor: theme.colors.surfaceMuted } : null,
      ]}
    >
      <View style={styles.rowLeft}>
        <Icon size={18} color={theme.colors.textSecondary} />
        <Text variant="body">{label}</Text>
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
