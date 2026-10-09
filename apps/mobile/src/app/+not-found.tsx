import { useRouter } from 'expo-router';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { useT } from '@/i18n';
import { useTheme } from '@/theme';

export default function NotFoundScreen() {
  const router = useRouter();
  const theme = useTheme();
  const t = useT();
  return (
    <Screen title={t('notFound.title')}>
      <Text color="textSecondary">{t('notFound.body')}</Text>
      <Button
        title={t('notFound.home')}
        onPress={() => router.replace('/')}
        variant="secondary"
        style={{ marginTop: theme.spacing.lg }}
      />
    </Screen>
  );
}
