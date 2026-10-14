import type { ConfigContext, ExpoConfig } from 'expo/config';

// The config file is evaluated by Node; the app's tsconfig has no Node types.
declare const process: { env: Record<string, string | undefined> };

/**
 * Extends app.json: when an Android OAuth client id is configured, Google's native redirect
 * scheme (the reversed client id) is registered so the sign-in can return to the app.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const clientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID?.trim();
  const base = config as ExpoConfig;
  const schemes = Array.isArray(base.scheme) ? base.scheme : base.scheme ? [base.scheme] : [];
  if (clientId) {
    const prefix = clientId.replace(/\.apps\.googleusercontent\.com$/, '');
    schemes.push(`com.googleusercontent.apps.${prefix}`);
  }
  return { ...base, scheme: schemes };
};
