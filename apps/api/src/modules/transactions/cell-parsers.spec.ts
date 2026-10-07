import {
  parseCellAmount,
  parseCellDate,
  parseCellPayment,
  parseCellTime,
  serialToIsoDate,
} from './cell-parsers';

describe('cell parsers', () => {
  it('parses Google date serials', () => {
    expect(serialToIsoDate(45000)).toBe('2023-03-15');
    expect(parseCellDate(46302)).toBe('2026-10-07');
    expect(parseCellDate(46302.75)).toBe('2026-10-07');
  });

  it('parses common Uzbek/European date strings', () => {
    expect(parseCellDate('07.10.2026')).toBe('2026-10-07');
    expect(parseCellDate('7/10/2026')).toBe('2026-10-07');
    expect(parseCellDate('2026-10-07')).toBe('2026-10-07');
    expect(parseCellDate('2026/10/07')).toBe('2026-10-07');
    expect(parseCellDate('not a date')).toBeNull();
    expect(parseCellDate('')).toBeNull();
  });

  it('parses times from serial fractions and strings', () => {
    expect(parseCellTime(0.5)).toBe('12:00');
    expect(parseCellTime(46302.25)).toBe('06:00');
    expect(parseCellTime('9:05')).toBe('09:05');
    expect(parseCellTime('18:30:00')).toBe('18:30');
    expect(parseCellTime('')).toBeNull();
  });

  it('parses amounts with thousands separators', () => {
    expect(parseCellAmount(-2500)).toBe(-2500);
    expect(parseCellAmount('1 250 000')).toBe(1250000);
    expect(parseCellAmount('-50,000')).toBe(-50000);
    expect(parseCellAmount('17,413,296')).toBe(17413296);
    expect(parseCellAmount('50000.5')).toBe(50000.5);
    expect(parseCellAmount('1,5')).toBe(1.5);
    expect(parseCellAmount('1\u00a0250\u00a0000')).toBe(1250000);
    expect(parseCellAmount('abc')).toBeNull();
  });

  it('maps legacy payment letters', () => {
    expect(parseCellPayment('N')).toBe('CASH');
    expect(parseCellPayment('p')).toBe('CARD');
    expect(parseCellPayment('Plastik')).toBe('CARD');
    expect(parseCellPayment('naqd')).toBe('CASH');
    expect(parseCellPayment('B')).toBe('BANK');
    expect(parseCellPayment('')).toBe('OTHER');
  });
});
