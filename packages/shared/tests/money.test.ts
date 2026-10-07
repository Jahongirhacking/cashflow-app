import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  formatCompactNumber,
  formatMoney,
  formatNumber,
  formatSignedMoney,
  fromSignedAmount,
  toSignedAmount,
} from '../src/utils/money';

describe('money formatting', () => {
  it('groups thousands', () => {
    assert.equal(formatNumber(25381420), '25,381,420');
    assert.equal(formatNumber(999), '999');
    assert.equal(formatNumber(-1234.5, 1), '-1,234.5');
  });

  it('formats money with currency label', () => {
    assert.equal(formatMoney(17413296), "17,413,296 so'm");
  });

  it('signs by transaction type', () => {
    assert.equal(formatSignedMoney(42280, 'EXPENSE'), "-42,280 so'm");
    assert.equal(formatSignedMoney(17413296, 'INCOME'), "+17,413,296 so'm");
  });

  it('compacts large values', () => {
    assert.equal(formatCompactNumber(8_700_000), '8.7M');
    assert.equal(formatCompactNumber(42_280), '42.3K');
    assert.equal(formatCompactNumber(1_000_000), '1M');
  });

  it('round-trips legacy signed amounts', () => {
    assert.deepEqual(fromSignedAmount(-50000), { type: 'EXPENSE', amount: 50000 });
    assert.deepEqual(fromSignedAmount(5000000), { type: 'INCOME', amount: 5000000 });
    assert.equal(toSignedAmount('EXPENSE', 50000), -50000);
    assert.equal(toSignedAmount('INCOME', 5000000), 5000000);
  });
});
