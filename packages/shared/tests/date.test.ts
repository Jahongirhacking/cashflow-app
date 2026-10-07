import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  addDays,
  daysInMonth,
  diffDays,
  monthKey,
  shiftMonthKey,
  toIsoDate,
} from '../src/utils/date';

describe('date helpers', () => {
  it('formats local dates', () => {
    assert.equal(toIsoDate(new Date(2026, 9, 7)), '2026-10-07');
  });

  it('shifts month keys across year boundaries', () => {
    assert.equal(shiftMonthKey('2026-01', -1), '2025-12');
    assert.equal(shiftMonthKey('2026-12', 1), '2027-01');
    assert.equal(monthKey('2026-10-07'), '2026-10');
  });

  it('knows month lengths and day arithmetic', () => {
    assert.equal(daysInMonth('2024-02'), 29);
    assert.equal(daysInMonth('2026-02'), 28);
    assert.equal(addDays('2026-10-31', 1), '2026-11-01');
    assert.equal(diffDays('2026-10-01', '2026-10-07'), 6);
  });
});
