import { describe, it, expect } from 'vitest';
import { BANDS, MEASURED, bandsFor, SCALE_MIN, SCALE_MAX } from './styles';

describe('band data integrity', () => {
  it('every band has min <= max', () => BANDS.forEach(b => expect(b.min).toBeLessThanOrEqual(b.max)));
  it('ids are unique', () => expect(new Set(BANDS.map(b => b.id)).size).toBe(BANDS.length));
  it('every extrapolated band carries a note explaining its basis', () =>
    BANDS.filter(b => b.tier === 'extrapolated').forEach(b => expect(b.note).toBeTruthy()));
  it('keeps both tiers', () => {
    expect(BANDS.some(b => b.tier === 'sourced')).toBe(true);
    expect(BANDS.some(b => b.tier === 'extrapolated')).toBe(true);
  });
  it('the scale spans every band and measured point', () => {
    BANDS.forEach(b => {
      expect(b.min).toBeGreaterThanOrEqual(SCALE_MIN);
      expect(b.max).toBeLessThanOrEqual(SCALE_MAX);
    });
    MEASURED.forEach(m => {
      expect(m.tf).toBeGreaterThanOrEqual(SCALE_MIN);
      expect(m.tf).toBeLessThanOrEqual(SCALE_MAX);
    });
  });
});

describe('bandsFor', () => {
  it('places recipe 1 in the thin/cracker region', () => {
    const ids = bandsFor(0.0779).map(b => b.id);
    expect(ids).toContain('cracker-crispy');
    expect(ids).toContain('neapolitan-hot');
  });
  it('places NY slice thickness correctly', () =>
    expect(bandsFor(0.092).map(b => b.id)).toContain('ny-slice'));
  it('places deep dish with its lip counted in the deep-dish band', () =>
    expect(bandsFor(0.1105).map(b => b.id)).toContain('chicago-deep-dish'));
  it('returns empty above every band rather than guessing', () => expect(bandsFor(0.30)).toEqual([]));
  it('is inclusive at boundaries', () =>
    expect(bandsFor(0.05).map(b => b.id)).toContain('cracker-crispy'));
});

describe('measured references', () => {
  it("includes both of the portal's recipes", () => {
    const ids = MEASURED.map(m => m.id);
    expect(ids).toContain('recipe-pastry-pizza');
    expect(ids).toContain('recipe-deep-dish-base');
  });
});
