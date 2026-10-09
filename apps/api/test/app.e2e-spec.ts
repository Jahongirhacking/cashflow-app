import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

describe('API (e2e)', () => {
  let app: INestApplication;
  let server: Server;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    server = app.getHttpServer() as Server;
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET / mirrors /health for platform probes', async () => {
    const response = await request(server).get('/').expect(200);
    expect(response.body).toMatchObject({ status: 'ok', service: 'my-cashify-api' });
  });

  it('GET /health reports ok', async () => {
    const response = await request(server).get('/health').expect(200);
    expect(response.body).toMatchObject({
      status: 'ok',
      service: 'my-cashify-api',
      environment: 'test',
    });
  });

  it('unknown routes return the structured error envelope', async () => {
    const response = await request(server).get('/does-not-exist').expect(404);
    expect(response.body).toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });
  });
});
