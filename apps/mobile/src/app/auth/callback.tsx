import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { FullScreenLoader } from '@/components/feedback/FullScreenLoader';
import { useAuth } from '@/features/auth/AuthProvider';
import { useT } from '@/i18n';

/**
 * Landing route after Google sign-in.
 * Web: the session cookie is already set — refresh the user and go home.
 * Native (deep link): exchange the one-time `code` for a token.
 */
export default function AuthCallbackScreen() {
  const router = useRouter();
  const auth = useAuth();
  const t = useT();
  const params = useLocalSearchParams<{ code?: string; error?: string }>();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const finish = async () => {
      if (params.error) {
        auth.setSignInError(params.error);
        router.replace('/login');
        return;
      }
      // Web and native both arrive with a one-time code; an old-style cookie-only redirect falls
      // back to refreshing the session. Never bounce back to "/" without a user: the protected
      // route would land here again and loop.
      let signedIn = false;
      if (params.code) {
        signedIn = await auth.completeNativeSignIn(params.code);
      } else {
        signedIn = (await auth.refresh()) !== null;
        if (!signedIn) auth.setSignInError('session_lost');
      }
      router.replace(signedIn ? '/' : '/login');
    };
    void finish();
  }, [auth, params.code, params.error, router]);

  return <FullScreenLoader label={t('auth.signingIn')} />;
}
