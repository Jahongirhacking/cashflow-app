import { validateEnv } from './env.schema';

const base = { JWT_SECRET: 'e2e-secret-e2e-secret-e2e-secret-1234567890' };

describe('env schema', () => {
  it('normalises bare hosts, quotes and trailing slashes in URL settings', () => {
    const env = validateEnv({
      ...base,
      API_PUBLIC_URL: 'api-xyz.northflank.app',
      APP_WEB_URL: '"https://app.example.com/"',
      GOOGLE_OAUTH_REDIRECT_URI: ' api.example.com/auth/google/callback ',
    });
    expect(env.API_PUBLIC_URL).toBe('https://api-xyz.northflank.app');
    expect(env.APP_WEB_URL).toBe('https://app.example.com');
    expect(env.GOOGLE_OAUTH_REDIRECT_URI).toBe('https://api.example.com/auth/google/callback');
  });

  it('keeps explicit schemes and defaults', () => {
    const env = validateEnv({ ...base, API_PUBLIC_URL: 'http://localhost:3000/' });
    expect(env.API_PUBLIC_URL).toBe('http://localhost:3000');
    expect(env.APP_WEB_URL).toBe('http://localhost:8081');
    expect(env.GOOGLE_OAUTH_REDIRECT_URI).toBeUndefined();
  });

  it('reports the rejected value for non-secret settings only', () => {
    expect(() => validateEnv({ ...base, API_PUBLIC_URL: 'not a url at all' })).toThrow(
      /API_PUBLIC_URL: .*\(received "not a url at all"\)/,
    );
    expect(() => validateEnv({ JWT_SECRET: 'short' })).toThrow(/JWT_SECRET: [^(]*$/m);
  });
});
