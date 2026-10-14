import { FullScreenLoader } from '@/components/feedback/FullScreenLoader';
import { useAuth } from '@/features/auth/AuthProvider';
import { useT } from '@/i18n';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';

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
    // Fallback applies to loading as well.
    const timer = setTimeout(() => {
      router.replace('/login');
    }, 10000);
    return () => clearTimeout(timer);
  }, [auth.status, router]);

  return <FullScreenLoader label={t('auth.signingIn')} />;
}
