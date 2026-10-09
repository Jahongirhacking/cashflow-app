import { type ArgumentsHost, NotFoundException } from '@nestjs/common';
import { ZodError } from 'zod';
import { AppException } from '../errors/app.exception';
import { HttpExceptionFilter } from './http-exception.filter';

function createHost() {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ method: 'GET', url: '/test' }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('HttpExceptionFilter', () => {
  const filter = new HttpExceptionFilter();

  it('serialises AppException with its code and details', () => {
    const { host, status, json } = createHost();
    filter.catch(
      new AppException(
        'SPREADSHEET_ACCESS_DENIED',
        'The My Cashify app cannot access this spreadsheet.',
      ),
      host,
    );
    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({
      statusCode: 403,
      code: 'SPREADSHEET_ACCESS_DENIED',
      message: 'The My Cashify app cannot access this spreadsheet.',
    });
  });

  it('maps built-in Nest exceptions to codes', () => {
    const { host, status, json } = createHost();
    filter.catch(new NotFoundException('Cannot GET /nope'), host);
    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'NOT_FOUND', message: 'Cannot GET /nope' }),
    );
  });

  it('maps zod errors to validation errors', () => {
    const { host, json } = createHost();
    filter.catch(new ZodError([{ code: 'custom', message: 'bad', path: ['amount'] }]), host);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'VALIDATION_ERROR',
        details: [{ path: 'amount', message: 'bad' }],
      }),
    );
  });

  it('hides internals of unknown errors', () => {
    const { host, status, json } = createHost();
    jest.spyOn(filter['logger'], 'error').mockImplementation(() => undefined);
    filter.catch(new Error('ECONNRESET secret host'), host);
    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong',
    });
  });
});
