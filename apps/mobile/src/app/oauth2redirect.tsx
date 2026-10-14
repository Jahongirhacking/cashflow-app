import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { FullScreenLoader } from '@/components/feedback/FullScreenLoader';
import { useAuth } from '@/features/auth/AuthProvider';
import { useT } from '@/i18n';

/**
 * Google's return address for the on-device sign-in is `com.googleusercontent.apps.<id>:/oauth2redirect`.
 * The auth session library consumes the code from that link, but Expo Router also opens it as a route;
 * without this screen it would land on "page not found". Wait for the session and move on.
 */
export default function OAuthRedirectScreen() {
  const router = useRouter();
  const auth = useAuth();
  const t = useT();

  useEffect(() => {
    if (auth.status === 'authenticated') {
      router.replace('/');
      return;
    }
    if (auth.status === 'loading') return;
    // Not signed in (yet): give the token exchange a moment, then fall back to the login screen.
    const timer = setTimeout(() => router.replace('/login'), 6000);
    return () => clearTimeout(timer);
  }, [auth.status, router]);

  return <FullScreenLoader label={t('auth.signingIn')} />;
}
