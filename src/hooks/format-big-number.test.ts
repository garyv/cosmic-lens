import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { format } from './format-big-number.ts';

describe('format', () => {
  it('returns numbers below 1,000 unchanged', () => {
    assert.equal(format(400), 400);
  });

  it('rounds to two decimals and names the unit from thousand to trillion', () => {
    assert.equal(format(12_000), '12 thousand');
    assert.equal(format(6_500_000), '6.5 million');
    assert.equal(format(13_800_000_000), '13.8 billion');
    assert.equal(format(9_460_730_472_580.8), '9.46 trillion');
  });

  it('uses quadrillion for anything larger', () => {
    assert.equal(format(10 ** 15), '1 quadrillion');
    assert.equal(format(10 ** 18), '1000 quadrillion');
  });
});
