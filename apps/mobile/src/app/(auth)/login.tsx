import { useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '@/components/ui/Card';
import { GoogleLogo } from '@/components/ui/GoogleLogo';
import { Text } from '@/components/ui/Text';
import { useAuth } from '@/features/auth/AuthProvider';
import { signInErrorMessage } from '@/features/auth/sign-in';
import { useInteractionState } from '@/hooks/useInteractionState';
import { useTheme } from '@/theme';

export default function LoginScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const auth = useAuth();
  const params = useLocalSearchParams<{ error?: string }>();

  useEffect(() => {
    if (params.error) auth.setSignInError(params.error);
    // Only react to the URL parameter changing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.error]);

  const errorMessage = signInErrorMessage(auth.lastSignInError);

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
        <View
          style={[
            styles.logo,
            { backgroundColor: theme.colors.primary, borderRadius: theme.radii.md },
          ]}
        >
          <Text variant="title" color="onPrimary">
            F
          </Text>
        </View>
        <Text variant="title" align="center" style={{ marginTop: theme.spacing.lg }}>
          Finance
        </Text>
        <Text
          variant="body"
          color="textSecondary"
          align="center"
          style={{ marginTop: theme.spacing.sm }}
        >
          Your Google Spreadsheet, as a modern finance app.
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
          We only use Google to confirm who you are. Your financial data stays in your own
          spreadsheet.
        </Text>
      </Card>
    </View>
  );
}

function GoogleButton({ onPress }: { onPress: () => void }) {
  const theme = useTheme();
  const { hovered, pressed, handlers } = useInteractionState();
  return (
    <Pressable
      {...handlers}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Continue with Google"
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
      <Text variant="bodyStrong">Continue with Google</Text>
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
