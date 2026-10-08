import { describeGoogleError, mapGoogleError } from './sheets-errors';

function googleError(status: number, message: string, reason?: string) {
  return {
    response: {
      status,
      data: {
        error: { status: 'PERMISSION_DENIED', message, details: reason ? [{ reason }] : [] },
      },
    },
  };
}

describe('mapGoogleError', () => {
  it('detects a disabled Sheets API by reason or message', () => {
    const byReason = mapGoogleError(googleError(403, 'nope', 'SERVICE_DISABLED'));
    expect(byReason.code).toBe('CONFIGURATION_ERROR');
    const byMessage = mapGoogleError(
      googleError(
        403,
        'Google Sheets API has not been used in project 123 before or it is disabled.',
      ),
    );
    expect(byMessage.code).toBe('CONFIGURATION_ERROR');
    expect(byMessage.getStatus()).toBe(503);
  });

  it('maps a plain 403 to access denied and 404 to not found', () => {
    expect(mapGoogleError(googleError(403, 'The caller does not have permission')).code).toBe(
      'SPREADSHEET_ACCESS_DENIED',
    );
    expect(mapGoogleError(googleError(404, 'Requested entity was not found.')).code).toBe(
      'SPREADSHEET_NOT_FOUND',
    );
    expect(mapGoogleError(googleError(429, 'Quota exceeded')).code).toBe('RATE_LIMITED');
    expect(mapGoogleError(new Error('socket hang up')).code).toBe('GOOGLE_API_ERROR');
  });

  it('describes errors for logs', () => {
    expect(describeGoogleError(googleError(403, 'disabled', 'SERVICE_DISABLED'))).toBe(
      'Google Sheets API error 403 [SERVICE_DISABLED]: disabled',
    );
    expect(describeGoogleError(new Error('boom'))).toBe('Google Sheets API error: boom');
  });
});
