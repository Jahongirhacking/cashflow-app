import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { AuthSession } from '@finance/shared';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { AuthService } from '../src/modules/auth/auth.service';
import { GoogleOAuthService } from '../src/modules/auth/google-oauth.service';

const profile = {
  googleId: 'google-123',
  email: 'jahongir@example.com',
  name: 'Jahongir',
  picture: null,
};

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  let authService: AuthService;
  const google = {
    isConfigured: true,
    buildAuthUrl: jest.fn(
      (state: string) => `https://accounts.google.com/o/oauth2/v2/auth?state=${state}`,
    ),
    exchangeCode: jest.fn(),
    verifyIdToken: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(GoogleOAuthService)
      .useValue(google)
      .compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    server = app.getHttpServer() as Server;
    authService = app.get(AuthService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    google.exchangeCode.mockReset();
    google.verifyIdToken.mockReset();
  });

  it('protects private routes', async () => {
    const res = await request(server).get('/auth/me').expect(401);
    expect(res.body).toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('web: redirects to Google with a signed state and nonce cookie', async () => {
    const res = await request(server).get('/auth/google?platform=web').expect(302);
    expect(res.headers.location).toMatch(/^https:\/\/accounts\.google\.com/);
    expect(res.headers['set-cookie']?.[0]).toMatch(/finance_oauth=.*HttpOnly/);
  });

  it('web: completes the round-trip, sets the session cookie and serves /auth/me', async () => {
    const start = await request(server).get('/auth/google?platform=web').expect(302);
    const state = new URL(start.headers.location as string).searchParams.get('state') as string;
    const nonceCookie = (start.headers['set-cookie'] as unknown as string[])[0]?.split(
      ';',
    )[0] as string;
    google.exchangeCode.mockResolvedValue(profile);

    const callback = await request(server)
      .get(`/auth/google/callback?code=abc&state=${encodeURIComponent(state)}`)
      .set('Cookie', nonceCookie)
      .expect(302);
    expect(callback.headers.location).toBe('http://localhost:8081/auth/callback');
    const sessionCookie = (callback.headers['set-cookie'] as unknown as string[])
      .map((c) => c.split(';')[0] as string)
      .find((c) => c.startsWith('finance_session='));
    expect(sessionCookie).toBeDefined();

    const me = await request(server)
      .get('/auth/me')
      .set('Cookie', sessionCookie as string)
      .expect(200);
    expect(me.body).toMatchObject({
      email: profile.email,
      name: 'Jahongir',
      hasSpreadsheet: false,
    });

    const logout = await request(server).post('/auth/logout').expect(204);
    expect(logout.headers['set-cookie']?.[0]).toMatch(/finance_session=;/);
  });

  it('web: rejects a callback whose nonce cookie does not match', async () => {
    const start = await request(server).get('/auth/google?platform=web').expect(302);
    const state = new URL(start.headers.location as string).searchParams.get('state') as string;
    const res = await request(server)
      .get(`/auth/google/callback?code=abc&state=${encodeURIComponent(state)}`)
      .set('Cookie', 'finance_oauth=wrong')
      .expect(302);
    expect(res.headers.location).toBe('http://localhost:8081/auth/callback?error=invalid_state');
    expect(google.exchangeCode).not.toHaveBeenCalled();
  });

  it('native: delivers a one-time code to the deep link and exchanges it for a bearer token', async () => {
    const redirect = 'finance://auth/callback';
    const start = await request(server)
      .get(`/auth/google?platform=native&redirect=${encodeURIComponent(redirect)}`)
      .expect(302);
    expect(start.headers['set-cookie']).toBeUndefined();
    const state = new URL(start.headers.location as string).searchParams.get('state') as string;
    google.exchangeCode.mockResolvedValue(profile);

    const callback = await request(server)
      .get(`/auth/google/callback?code=abc&state=${encodeURIComponent(state)}`)
      .expect(302);
    const location = new URL(callback.headers.location as string);
    expect(`${location.protocol}//${location.host}${location.pathname}`).toBe(redirect);
    const code = location.searchParams.get('code') as string;

    const exchanged = await request(server).post('/auth/exchange').send({ code }).expect(200);
    const session = exchanged.body as AuthSession;
    expect(session.accessToken).toEqual(expect.any(String));
    expect(session.user.email).toBe(profile.email);

    await request(server).post('/auth/exchange').send({ code }).expect(401);
    const me = await request(server)
      .get('/auth/me')
      .set('Authorization', `Bearer ${session.accessToken as string}`)
      .expect(200);
    expect((me.body as { id: string }).id).toBe(session.user.id);
  });

  it('native: refuses redirects to foreign schemes', async () => {
    const res = await request(server)
      .get(
        `/auth/google?platform=native&redirect=${encodeURIComponent('https://evil.example/steal')}`,
      )
      .expect(400);
    expect(res.body).toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('maps a cancelled Google consent to a friendly error redirect', async () => {
    const { state } = authService.createState('native', 'finance://auth/callback');
    const res = await request(server)
      .get(`/auth/google/callback?error=access_denied&state=${encodeURIComponent(state)}`)
      .expect(302);
    expect(res.headers.location).toBe('finance://auth/callback?error=cancelled');
  });

  it('signs in with a client-side ID token', async () => {
    google.verifyIdToken.mockResolvedValue({
      ...profile,
      googleId: 'google-999',
      email: 'other@example.com',
    });
    const res = await request(server)
      .post('/auth/google')
      .send({ idToken: 'x'.repeat(32) })
      .expect(200);
    const session = res.body as AuthSession;
    expect(session.user.email).toBe('other@example.com');
    expect(session.accessToken).toEqual(expect.any(String));
  });
});
