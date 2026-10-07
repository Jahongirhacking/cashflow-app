import { a1, columnIndex, columnLetter, parseA1 } from './a1';

describe('A1 helpers', () => {
  it('converts column indexes', () => {
    expect(columnLetter(1)).toBe('A');
    expect(columnLetter(26)).toBe('Z');
    expect(columnLetter(27)).toBe('AA');
    expect(columnLetter(52)).toBe('AZ');
    expect(columnIndex('AA')).toBe(27);
  });

  it('builds and parses ranges with quoted titles', () => {
    expect(a1("Jahon's", 1, 2, 6)).toBe("'Jahon''s'!A2:F");
    expect(parseA1("'Jahon''s'!A2:F")).toEqual({
      sheet: "Jahon's",
      startCol: 1,
      startRow: 2,
      endCol: 6,
      endRow: null,
    });
    expect(parseA1('Transactions!G1:Z100')).toEqual({
      sheet: 'Transactions',
      startCol: 7,
      startRow: 1,
      endCol: 26,
      endRow: 100,
    });
    expect(parseA1('Sheet1!A:A')).toEqual({
      sheet: 'Sheet1',
      startCol: 1,
      startRow: null,
      endCol: 1,
      endRow: null,
    });
  });
});
