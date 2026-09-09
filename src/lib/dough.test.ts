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

import { totalG, scaleIngredients, bakersPercents, referenceTable, type Ingredient } from './dough';

const RECIPE1_2BALL: Ingredient[] = [
  { item: 'All-purpose flour', g: 228, isFlour: true }, { item: 'Cornstarch', g: 9 },
  { item: 'Sugar', g: 10 }, { item: 'Fine salt', g: 4.5 }, { item: 'Instant yeast', g: 3.5 },
  { item: 'Xanthan gum', g: 1 }, { item: 'Sunflower lecithin powder', g: 2, optional: true },
  { item: 'Cool water', g: 118 }, { item: 'Olive oil', g: 42 },
];

describe('scaleIngredients', () => {
  it('reproduces the printed 4-ball batch exactly when doubled', () => {
    const scaled = scaleIngredients(RECIPE1_2BALL, 836);
    const byItem = Object.fromEntries(scaled.map(i => [i.item, Math.round(i.g * 10) / 10]));
    expect(byItem['All-purpose flour']).toBe(456);
    expect(byItem['Cornstarch']).toBe(18);
    expect(byItem['Sugar']).toBe(20);
    expect(byItem['Fine salt']).toBe(9);
    expect(byItem['Instant yeast']).toBe(7);
    expect(byItem['Xanthan gum']).toBe(2);
    expect(byItem['Sunflower lecithin powder']).toBe(4);
    expect(byItem['Cool water']).toBe(236);
    expect(byItem['Olive oil']).toBe(84);
  });
  it('hits the requested total', () =>
    expect(totalG(scaleIngredients(RECIPE1_2BALL, 1234))).toBeCloseTo(1234, 6));
  it('preserves item order, flags and notes', () => {
    const scaled = scaleIngredients(RECIPE1_2BALL, 500);
    expect(scaled.map(i => i.item)).toEqual(RECIPE1_2BALL.map(i => i.item));
    expect(scaled.find(i => i.item === 'Sunflower lecithin powder')?.optional).toBe(true);
  });
  it('drops volume strings, which cannot be scaled', () => {
    const scaled = scaleIngredients([{ item: 'Flour', g: 100, vol: '3/4 cup' }], 200);
    expect(scaled[0]!.vol).toBeUndefined();
  });
  it('throws rather than silently dividing by zero', () =>
    expect(() => scaleIngredients([{ item: 'x', g: 0 }], 100)).toThrow());
});

describe('bakersPercents', () => {
  it("matches Real Deep Dish's own published percentages", () => {
    const rdd: Ingredient[] = [
      { item: 'All Purpose Flour', g: 312.5, isFlour: true }, { item: 'Water', g: 159.3 },
      { item: 'Vegetable/Corn Oil', g: 54 }, { item: 'IDY Yeast', g: 3.1 },
      { item: 'Fine Sea Salt', g: 1.4 }, { item: 'Sugar', g: 1 },
    ];
    const pct = Object.fromEntries(bakersPercents(rdd).map(p => [p.item, p.pct]));
    expect(pct['All Purpose Flour']).toBeCloseTo(100, 6);
    expect(pct['Water']).toBeCloseTo(51, 1);
    expect(pct['Vegetable/Corn Oil']).toBeCloseTo(17.25, 1);
    expect(pct['IDY Yeast']).toBeCloseTo(1, 1);
  });
  it('throws when no flour is marked', () =>
    expect(() => bakersPercents([{ item: 'Water', g: 100 }])).toThrow(/flour/i));
});

describe('referenceTable', () => {
  const t = referenceTable({ ozFrom: 8, ozTo: 9, ozStep: 0.5, diameters: [10, 12] });
  it('produces a row per weight step', () => expect(t.rows.map(r => r.oz)).toEqual([8, 8.5, 9]));
  it('reproduces the published worksheet cells', () => {
    expect(+t.rows[0]!.tf[0]!.toFixed(3)).toBe(0.102);
    expect(+t.rows[0]!.tf[1]!.toFixed(3)).toBe(0.071);
    expect(+t.rows[2]!.tf[0]!.toFixed(3)).toBe(0.115);
  });
  it('carries the gram equivalent of each row', () => expect(t.rows[0]!.g).toBeCloseTo(226.8, 1));
});

import { roundDiameterForArea, rectLengthForArea } from './dough';

describe('wall-aware inverse geometry', () => {
  it('roundDiameterForArea inverts areaIn2 with no wall', () => {
    const a = areaIn2({ kind: 'round', diameterIn: 14 });
    near(roundDiameterForArea(a, 0), 14, 6);
  });
  it('roundDiameterForArea inverts areaIn2 with a wall', () => {
    const a = areaIn2({ kind: 'round', diameterIn: 12, wallIn: 1.25 });
    near(roundDiameterForArea(a, 1.25), 12, 6);
  });
  it('rectLengthForArea inverts areaIn2 with no wall', () => {
    const a = areaIn2({ kind: 'rect', lengthIn: 14, widthIn: 10 });
    near(rectLengthForArea(a, 10, 0), 14, 6);
  });
  it('rectLengthForArea inverts areaIn2 with a wall', () => {
    const a = areaIn2({ kind: 'rect', lengthIn: 14, widthIn: 10, wallIn: 1 });
    near(rectLengthForArea(a, 10, 1), 14, 6);
  });
  it('solves the size a known dough ball wants: 15.39 oz at TF 0.10 is a 14 inch pizza', () => {
    near(roundDiameterForArea(15.3938 / 0.1, 0), 14, 3);
  });
});
