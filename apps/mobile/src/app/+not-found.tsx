import { useRouter } from 'expo-router';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme';

export default function NotFoundScreen() {
  const router = useRouter();
  const theme = useTheme();
  return (
    <Screen title="Page not found">
      <Text color="textSecondary">The page you were looking for doesn&apos;t exist.</Text>
      <Button
        title="Go to dashboard"
        onPress={() => router.replace('/')}
        variant="secondary"
        style={{ marginTop: theme.spacing.lg }}
      />
    </Screen>
  );
}
