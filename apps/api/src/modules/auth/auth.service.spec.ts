import { JwtService } from '@nestjs/jwt';
import { AppException } from '../../common/errors/app.exception';
import type { AppConfigService } from '../../config/app-config.service';
import { AuthService } from './auth.service';

const config = {
  jwtSecret: 'unit-test-secret-unit-test-secret-1234567890',
  jwtExpiresIn: '1h',
} as AppConfigService;

describe('AuthService', () => {
  const service = new AuthService(new JwtService({}), config);

  it('issues and verifies session tokens', () => {
    const session = service.issueSession('usr_1');
    expect(session.expiresAt).toBeGreaterThan(Date.now());
    expect(service.verifySession(session.accessToken)).toBe('usr_1');
  });

  it('rejects tampered or foreign tokens', () => {
    const { accessToken } = service.issueSession('usr_1');
    expect(() => service.verifySession(`${accessToken}x`)).toThrow(AppException);
    const { state } = service.createState('web', null);
    expect(() => service.verifySession(state)).toThrow(AppException); // wrong audience
  });

  it('round-trips OAuth state', () => {
    const { state, nonce } = service.createState('native', 'finance://auth/callback');
    expect(service.verifyState(state)).toEqual({
      platform: 'native',
      redirect: 'finance://auth/callback',
      nonce,
    });
    expect(() => service.verifyState('garbage')).toThrow(AppException);
  });

  it('exchange codes are single use', () => {
    const code = service.issueExchangeCode('usr_7');
    expect(service.consumeExchangeCode(code)).toBe('usr_7');
    expect(() => service.consumeExchangeCode(code)).toThrow(AppException);
    expect(() => service.consumeExchangeCode('nope')).toThrow(AppException);
  });
});
