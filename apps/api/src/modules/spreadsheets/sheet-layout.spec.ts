import {
  chooseAppBlockColumn,
  findAppBlockColumn,
  isLegacyTransactionsHeader,
} from './sheet-layout';

describe('sheet layout detection', () => {
  it('recognises the legacy Uzbek header', () => {
    expect(
      isLegacyTransactionsHeader([
        "To'lov Nomi",
        'Narx (+ Kirim / - Chiqim)',
        "To'lov turi (N/P)",
        'Sana',
        'Vaqt',
        'Kategoriya',
      ]),
    ).toBe(true);
    expect(
      isLegacyTransactionsHeader(['Name', 'Amount', 'Payment', 'Date', 'Time', 'Category']),
    ).toBe(true);
    expect(isLegacyTransactionsHeader(['Foo', 'Bar'])).toBe(false);
    expect(isLegacyTransactionsHeader([])).toBe(false);
  });

  it('finds an existing Finance ID column', () => {
    expect(findAppBlockColumn(['a', 'b', '', '', '', '', '', '', '', 'Finance ID'])).toBe(10);
    expect(findAppBlockColumn(['a', 'b'])).toBeNull();
  });

  it('skips columns used by summary cells when placing the app block', () => {
    // columns G.. (minColumn 7): H and I hold the Naqd/Plastik summary in the first rows
    const rows = [
      ['', 'Naqd', 1000],
      ['', 'Plastik', 2000],
      ['', 'Jami', 3000],
    ];
    expect(chooseAppBlockColumn(rows, 7)).toBe(10); // J
    expect(chooseAppBlockColumn([], 7)).toBe(7); // G
  });
});
