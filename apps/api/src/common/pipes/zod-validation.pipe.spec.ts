import { z } from 'zod';
import { AppException } from '../errors/app.exception';
import { ZodValidationPipe } from './zod-validation.pipe';

describe('ZodValidationPipe', () => {
  const pipe = new ZodValidationPipe(
    z.object({ amount: z.coerce.number().positive(), name: z.string().min(1) }),
  );

  it('returns parsed data on success', () => {
    expect(pipe.transform({ amount: '42', name: 'Metro' })).toEqual({ amount: 42, name: 'Metro' });
  });

  it('throws a structured VALIDATION_ERROR on failure', () => {
    try {
      pipe.transform({ amount: -1, name: '' });
      fail('expected an exception');
    } catch (error) {
      expect(error).toBeInstanceOf(AppException);
      const appError = error as AppException;
      expect(appError.code).toBe('VALIDATION_ERROR');
      expect(appError.getStatus()).toBe(400);
      expect(appError.details?.map((d) => d.path)).toEqual(['amount', 'name']);
    }
  });
});
