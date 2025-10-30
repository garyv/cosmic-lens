import { test, describe, assert } from 'vitest';
import { format } from './format-big-number.ts';

describe.concurrent('format', () => {
  test('hundreds', () => {
    assert.equal(
      `The telescope was invented about 400 years ago`,
      `The telescope was invented about ${format(400)} years ago`
    );
  });

  test('thousands', () => {
    assert.equal(
      `Agriculture began around 12 thousand years ago`,
      `Agriculture began around ${format(12_000)} years ago`
    );
  });

  test('billions', () => {
    assert.equal(
      `The universe began with the Big Bang 13.8 billion years ago`,
      `The universe began with the Big Bang ${format(13_800_000_000)} years ago`
    );
  });

  test('trillions', () => {
    assert.equal(
      `A lightyear is approximately 9.46 trillion meters`,
      `A lightyear is approximately ${format(9_460_730_472_580.8)} meters`
    );
  });

  test('millions', () => {
    assert.equal(
      `Dinosaurs walked the Earth until 6.5 million years ago`,
      `Dinosaurs walked the Earth until ${format(6_500_000)} years ago`
    );
  });

  test('quadrillion', () => {
    assert.equal(
      `1 quadrillion equals 10^15`,
      `${format(10 ** 15)} equals 10^15`
    );
  });
});
