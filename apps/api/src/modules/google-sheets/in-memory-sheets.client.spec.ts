import { AppException } from '../../common/errors/app.exception';
import { InMemorySheetsClient } from './in-memory-sheets.client';

describe('InMemorySheetsClient', () => {
  let client: InMemorySheetsClient;

  beforeEach(() => {
    client = new InMemorySheetsClient();
    client.seed('ss1', 'Budget', [
      {
        title: 'Sheet1',
        rows: [
          ['Name', 'Amount', '', 'Date'],
          ['Metro', -2500, 'P', 46000],
          [],
          ['Salary', 5000000, 'N', 46001],
        ],
      },
    ]);
  });

  it('trims trailing empties on read like Google does', async () => {
    const rows = await client.getValues('ss1', "'Sheet1'!A1:D");
    expect(rows).toEqual([
      ['Name', 'Amount', '', 'Date'],
      ['Metro', -2500, 'P', 46000],
      [],
      ['Salary', 5000000, 'N', 46001],
    ]);
    expect(await client.getValues('ss1', 'Sheet1!B2:B2')).toEqual([[-2500]]);
    expect(await client.getValues('ss1', 'Sheet1!F1:H')).toEqual([]);
  });

  it('writes, grows and deletes rows', async () => {
    await client.updateValues('ss1', 'Sheet1!A6:B6', [['Rent', -1000000]]);
    expect((await client.getValues('ss1', 'Sheet1!A1:B')).length).toBe(6);
    await client.deleteRows('ss1', 1, 2, 3);
    expect(await client.getValues('ss1', 'Sheet1!A2:A2')).toEqual([['Salary']]);
  });

  it('rejects writes past the grid until rows are appended, like Google', async () => {
    const tall = Array.from({ length: 3 }, (_, i) => [`Row ${i}`]);
    await expect(client.updateValues('ss1', 'Sheet1!A999:A1001', tall)).rejects.toMatchObject({
      code: 'GOOGLE_API_ERROR',
      message: expect.stringContaining('exceeds grid limits') as string,
    });
    await client.appendRows('ss1', 1, 10);
    expect((await client.getSpreadsheet('ss1')).sheets[0]?.rowCount).toBe(1010);
    await client.updateValues('ss1', 'Sheet1!A999:A1001', tall);
    expect(await client.getValues('ss1', 'Sheet1!A1001:A1001')).toEqual([['Row 2']]);
  });

  it('simulates access and existence errors', async () => {
    await expect(client.getSpreadsheet('missing')).rejects.toMatchObject({
      code: 'SPREADSHEET_NOT_FOUND',
    });
    client.setAccessDenied('ss1', true);
    await expect(client.getValues('ss1', 'Sheet1!A1:A')).rejects.toBeInstanceOf(AppException);
    await expect(client.getValues('ss1', 'Sheet1!A1:A')).rejects.toMatchObject({
      code: 'SPREADSHEET_ACCESS_DENIED',
    });
  });
});
