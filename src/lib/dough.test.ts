import { describe, it, expect } from 'vitest';
import {
  areaIn2, tfFromGrams, doughWeightOz, diameterForTf, thicknessFactor, GCM2_PER_OZIN2,
} from './dough';

const near = (a: number, b: number, d = 4) => expect(a).toBeCloseTo(b, d);

describe('areaIn2', () => {
  it('computes round area from diameter', () => near(areaIn2({ kind: 'round', diameterIn: 12 }), 113.0973, 3));
  it('computes rect area', () => near(areaIn2({ kind: 'rect', lengthIn: 14, widthIn: 10 }), 140, 6));
  it('adds the wall of a round pan', () =>
    near(areaIn2({ kind: 'round', diameterIn: 12, wallIn: 1.5 }), 113.0973 + Math.PI * 12 * 1.5, 3));
  it('adds the wall of a rect pan', () =>
    near(areaIn2({ kind: 'rect', lengthIn: 14, widthIn: 10, wallIn: 1 }), 140 + 2 * (14 + 10) * 1, 6));
  it('treats a zero wall as no wall', () =>
    near(areaIn2({ kind: 'round', diameterIn: 12, wallIn: 0 }), areaIn2({ kind: 'round', diameterIn: 12 }), 6));
});

// Published cells from "Thickness Factor Spreadsheet V3", pizzamaking.com topic 39674.
describe('thicknessFactor reproduces the published worksheet', () => {
  const cells: Array<[number, number, number]> = [
    [8, 10, 0.102], [8, 24, 0.018], [15, 16, 0.075], [35, 24, 0.077],
    [12, 14, 0.078], [22, 18, 0.086], [17.5, 13, 0.132],
  ];
  it.each(cells)('%f oz at %f in => %f', (oz, dia, expected) => {
    expect(+thicknessFactor(oz, { kind: 'round', diameterIn: dia }).toFixed(3)).toBe(expected);
  });
});

describe('thicknessFactor against real recipes', () => {
  it('recipe 1: 210 g ball at 11 in', () => near(tfFromGrams(210, { kind: 'round', diameterIn: 11 }), 0.0779));
  it("recipe 2: reproduces Real Deep Dish's published 0.1657", () =>
    near(tfFromGrams(531.3, { kind: 'round', diameterIn: 12 }), 0.1657));
  it('recipe 2 with a 1.5 in lip drops into the forum deep-dish band', () => {
    const tf = tfFromGrams(531.3, { kind: 'round', diameterIn: 12, wallIn: 1.5 });
    expect(tf).toBeGreaterThan(0.11);
    expect(tf).toBeLessThan(0.135);
  });
});

describe('inverse solvers', () => {
  it('doughWeightOz inverts thicknessFactor', () => {
    const shape = { kind: 'round', diameterIn: 14 } as const;
    near(doughWeightOz(0.1, shape), 15.3938, 3);
    near(thicknessFactor(doughWeightOz(0.1, shape), shape), 0.1);
  });
  it('diameterForTf inverts too', () => near(diameterForTf(0.1, 15.3938), 14, 3));
});

it('exposes the metric conversion that trips people up', () => near(GCM2_PER_OZIN2, 4.3943));
