import { describe, it, expect } from 'vitest';
import { fmtGrams, fmtTf, fmtTfMetric, fmtIn } from './format';

describe('fmtGrams rounds to a precision a kitchen scale can use', () => {
  it('whole grams at or above 10 g', () => expect(fmtGrams(456.23)).toBe('456 g'));
  it('one decimal below 10 g', () => expect(fmtGrams(4.47)).toBe('4.5 g'));
  it('trims a trailing .0', () => expect(fmtGrams(9.02)).toBe('9 g'));
  it('handles zero', () => expect(fmtGrams(0)).toBe('0 g'));
});

describe('fmtTf always carries its unit', () => {
  it('formats oz/in² to three decimals', () => expect(fmtTf(0.07794)).toBe('0.078 oz/in²'));
  it('formats the metric equivalent', () => expect(fmtTfMetric(0.1)).toBe('0.439 g/cm²'));
});

describe('fmtIn', () => {
  it('drops a trailing zero', () => expect(fmtIn(12)).toBe('12″'));
  it('keeps a real fraction', () => expect(fmtIn(1.5)).toBe('1.5″'));
  it('keeps two decimals when they matter', () => expect(fmtIn(1.25)).toBe('1.25″'));
});
