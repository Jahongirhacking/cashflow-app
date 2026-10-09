import { useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import appIcon from '../../../assets/icon.png';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '@/components/ui/Card';
import { GoogleLogo } from '@/components/ui/GoogleLogo';
import { Text } from '@/components/ui/Text';
import { useAuth } from '@/features/auth/AuthProvider';
import { signInErrorKey } from '@/features/auth/sign-in';
import { useT } from '@/i18n';
import { useInteractionState } from '@/hooks/useInteractionState';
import { useTheme } from '@/theme';

export default function LoginScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const auth = useAuth();
  const t = useT();
  const params = useLocalSearchParams<{ error?: string }>();

  useEffect(() => {
    if (params.error) auth.setSignInError(params.error);
    // Only react to the URL parameter changing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.error]);

  const errorKey = signInErrorKey(auth.lastSignInError);
  const errorMessage = errorKey ? t(errorKey) : null;

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: theme.colors.background,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        },
      ]}
    >
      <Card padding="lg" style={styles.card}>
        <Image
          source={appIcon}
          style={[styles.logo, { borderRadius: theme.radii.md }]}
          accessibilityIgnoresInvertColors
        />
        <Text variant="title" align="center" style={{ marginTop: theme.spacing.lg }}>
          {t('common.appName')}
        </Text>
        <Text
          variant="body"
          color="textSecondary"
          align="center"
          style={{ marginTop: theme.spacing.sm }}
        >
          {t('auth.tagline')}
        </Text>

        {errorMessage ? (
          <View
            accessibilityRole="alert"
            style={[
              styles.alert,
              {
                backgroundColor: theme.colors.expenseSoft,
                borderRadius: theme.radii.md,
                marginTop: theme.spacing.xl,
              },
            ]}
          >
            <Text variant="caption" color="expense">
              {errorMessage}
            </Text>
          </View>
        ) : null}

        <GoogleButton onPress={() => void auth.signInWithGoogle()} />

        <Text
          variant="caption"
          color="textMuted"
          align="center"
          style={{ marginTop: theme.spacing.lg }}
        >
          {t('auth.privacy')}
        </Text>
      </Card>
    </View>
  );
}

function GoogleButton({ onPress }: { onPress: () => void }) {
  const theme = useTheme();
  const t = useT();
  const { hovered, pressed, handlers } = useInteractionState();
  return (
    <Pressable
      {...handlers}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('auth.continueWithGoogle')}
      style={[
        styles.googleButton,
        {
          backgroundColor: hovered || pressed ? theme.colors.surfaceMuted : theme.colors.surface,
          borderColor: theme.colors.borderStrong,
          borderRadius: theme.radii.md,
          marginTop: theme.spacing.xl,
        },
      ]}
    >
      <GoogleLogo size={18} />
      <Text variant="bodyStrong">{t('auth.continueWithGoogle')}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 400, alignItems: 'stretch' },
  logo: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  alert: { paddingHorizontal: 12, paddingVertical: 10 },
  googleButton: {
    height: 48,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
});
