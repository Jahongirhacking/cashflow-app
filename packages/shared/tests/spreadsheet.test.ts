import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { connectSpreadsheetSchema, extractSpreadsheetId } from '../src/domain/spreadsheet';

describe('extractSpreadsheetId', () => {
  const id = '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms';

  it('reads the id from edit urls', () => {
    assert.equal(
      extractSpreadsheetId(`https://docs.google.com/spreadsheets/d/${id}/edit#gid=0`),
      id,
    );
    assert.equal(extractSpreadsheetId(`https://docs.google.com/spreadsheets/d/${id}`), id);
    assert.equal(
      extractSpreadsheetId(`https://docs.google.com/spreadsheets/u/1/d/${id}/edit?usp=sharing`),
      id,
    );
  });

  it('rejects non-sheet urls', () => {
    assert.equal(extractSpreadsheetId('https://docs.google.com/document/d/abc/edit'), null);
    assert.equal(extractSpreadsheetId('not a url'), null);
    assert.equal(extractSpreadsheetId(''), null);
  });

  it('validates the connect payload', () => {
    assert.equal(connectSpreadsheetSchema.safeParse({ spreadsheetUrl: 'nope' }).success, false);
    assert.equal(
      connectSpreadsheetSchema.safeParse({
        spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${id}/edit`,
      }).success,
      true,
    );
  });
});
