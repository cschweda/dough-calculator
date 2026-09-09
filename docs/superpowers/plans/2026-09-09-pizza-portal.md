# Pizza Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A static Astro portal for pizza and bread recipes — card grid home page, recipe pages that print cleanly, and a dough thickness calculator that also scales any recipe to any pan.

**Architecture:** One pure calculation module (`src/lib/dough.ts`) feeds two surfaces: a standalone calculator page and a "scale to my pan" mode on every recipe page. Recipes are typed content-collection entries; ingredient data lives in frontmatter, prose in the Markdown body. All interactivity is progressive enhancement over HTML that already works.

**Tech Stack:** Astro 5 (static), TypeScript strict, Vitest, plain CSS with custom properties. No UI framework, no CSS framework — the print stylesheet and dual-theme tokens are easier to control directly, and unused CSS would cost Lighthouse points.

**Spec:** `docs/superpowers/specs/2026-09-09-pizza-portal-design.md`

## Global Constraints

Every task's requirements implicitly include these.

- **Static output.** `output: 'static'`. No SSR, no client framework, no hydration directives.
- **TypeScript strict.** `"strict": true`, `"noUncheckedIndexedAccess": true`.
- **All computation in ounces and inches internally.** Grams and centimetres are converted at the boundary. `G_PER_OZ = 28.35` (the divisor the source method specifies — not 28.3495).
- **TF is never rendered as a bare number.** Always with its unit, `oz/in²`.
- **Dark is the default theme on first visit.** `prefers-color-scheme` is NOT consulted for the initial value.
- **No-JS baseline:** recipe pages render every batch with both grams and volume columns; the calculator page renders formula, style tables, and reference table as static content.
- **Band tiering is visible in the UI:** `sourced` (cited) / `extrapolated` (marked inferred) / `measured` (from portal recipes) must be distinguishable without color alone.
- **Accessibility gates, all must pass:** lightcap `run_a11y` = 100 every page; axecap `audit_url` = 0 violations; contrastcap `check_page_contrast` = 0 failures in both themes; usable at 320px and 200% zoom.
- **Recipe #2 attribution:** prominent credit, link to realdeepdish.com, author's donation link, method condensed rather than reproduced verbatim.
- **Commits:** no AI co-author trailer (user's global rule).

---

### Task 1: Scaffold project and test harness

**Files:**
- Create: `package.json`, `astro.config.mjs`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`, `src/env.d.ts`

**Interfaces:**
- Consumes: nothing
- Produces: working `npm run dev`, `npm run build`, `npm test`

- [ ] **Step 1: Create the Astro project non-interactively**

```bash
npm create astro@latest . -- --template minimal --no-install --no-git --typescript strict --skip-houston
npm install
npm install -D vitest
```

- [ ] **Step 2: Set static output and a site URL**

`astro.config.mjs`:

```js
import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  site: 'https://pizza-portal.local',
  build: { inlineStylesheets: 'auto' },
});
```

- [ ] **Step 3: Add vitest config and test script**

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
});
```

Add to `package.json` scripts: `"test": "vitest run"`, `"test:watch": "vitest"`.

- [ ] **Step 4: Tighten tsconfig**

Ensure `compilerOptions` includes `"strict": true` and `"noUncheckedIndexedAccess": true`.

- [ ] **Step 5: Verify all three commands work**

Run: `npm run build && npm test -- --passWithNoTests`
Expected: build succeeds, vitest exits 0.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "Scaffold Astro project with Vitest"
```

---

### Task 2: Dough engine — area and thickness factor

**Files:**
- Create: `src/lib/dough.ts`
- Test: `src/lib/dough.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  ```ts
  export const G_PER_OZ = 28.35;
  export const GCM2_PER_OZIN2: number;      // 4.3943…
  export type Shape =
    | { kind: 'round'; diameterIn: number; wallIn?: number }
    | { kind: 'rect'; lengthIn: number; widthIn: number; wallIn?: number };
  export function areaIn2(shape: Shape): number;
  export function thicknessFactor(doughOz: number, shape: Shape): number;
  export function tfFromGrams(doughG: number, shape: Shape): number;
  export function doughWeightOz(tf: number, shape: Shape): number;
  export function diameterForTf(tf: number, doughOz: number): number;
  export function ozToG(oz: number): number;
  export function gToOz(g: number): number;
  ```

- [ ] **Step 1: Write the failing tests**

`src/lib/dough.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { areaIn2, tfFromGrams, doughWeightOz, diameterForTf, thicknessFactor, GCM2_PER_OZIN2 } from './dough';

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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — cannot resolve `./dough`.

- [ ] **Step 3: Implement**

`src/lib/dough.ts`:

```ts
/** Grams per ounce, as specified by the pizzamaking.com method. */
export const G_PER_OZ = 28.35;
/** 1 oz/in² expressed in g/cm². The source thread's "divide by ~4.5". */
export const GCM2_PER_OZIN2 = G_PER_OZ / 6.4516;

export type Shape =
  | { kind: 'round'; diameterIn: number; wallIn?: number }
  | { kind: 'rect'; lengthIn: number; widthIn: number; wallIn?: number };

export const gToOz = (g: number): number => g / G_PER_OZ;
export const ozToG = (oz: number): number => oz * G_PER_OZ;

/**
 * Dough-bearing area. `wallIn` is the height dough is pressed up the pan side;
 * published figures differ on whether it is counted, so it is explicit.
 */
export function areaIn2(shape: Shape): number {
  const wall = shape.wallIn ?? 0;
  if (shape.kind === 'round') {
    const r = shape.diameterIn / 2;
    return Math.PI * r * r + Math.PI * shape.diameterIn * wall;
  }
  return shape.lengthIn * shape.widthIn + 2 * (shape.lengthIn + shape.widthIn) * wall;
}

/** TF = dough weight (oz) / area (in²). Units: oz/in². */
export const thicknessFactor = (doughOz: number, shape: Shape): number => doughOz / areaIn2(shape);

export const tfFromGrams = (doughG: number, shape: Shape): number =>
  thicknessFactor(gToOz(doughG), shape);

export const doughWeightOz = (tf: number, shape: Shape): number => tf * areaIn2(shape);

/** Round pizzas only: the diameter that puts `doughOz` at `tf`. */
export const diameterForTf = (tf: number, doughOz: number): number =>
  2 * Math.sqrt(doughOz / (tf * Math.PI));
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, all cases.

- [ ] **Step 5: Commit**

```bash
git add src/lib/dough.ts src/lib/dough.test.ts
git commit -m "Add dough thickness engine, verified against published worksheet"
```

---

### Task 3: Dough engine — proportional scaling and bakers' percentages

**Files:**
- Modify: `src/lib/dough.ts`
- Test: `src/lib/dough.test.ts`

**Interfaces:**
- Consumes: Task 2's module
- Produces:
  ```ts
  export interface Ingredient {
    item: string; g: number; vol?: string; optional?: boolean;
    note?: string; isFlour?: boolean;
  }
  export function totalG(ings: readonly Ingredient[]): number;
  export function scaleIngredients(ings: readonly Ingredient[], targetTotalG: number): Ingredient[];
  export function bakersPercents(ings: readonly Ingredient[]): Array<{ item: string; pct: number }>;
  ```

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/dough.test.ts`:

```ts
import { totalG, scaleIngredients, bakersPercents, type Ingredient } from './dough';

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
  it('hits the requested total', () => expect(totalG(scaleIngredients(RECIPE1_2BALL, 1234))).toBeCloseTo(1234, 6));
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `scaleIngredients` is not exported.

- [ ] **Step 3: Implement**

Append to `src/lib/dough.ts`:

```ts
export interface Ingredient {
  item: string;
  /** Canonical quantity, grams. */
  g: number;
  /** Human volume, e.g. "1¾ cups + 2 Tbsp". Display only — cannot be scaled. */
  vol?: string;
  optional?: boolean;
  note?: string;
  /** Marks the 100% reference for bakers' percentages. Not needed for scaling. */
  isFlour?: boolean;
}

export const totalG = (ings: readonly Ingredient[]): number =>
  ings.reduce((sum, i) => sum + i.g, 0);

/**
 * Scale a batch to a target total weight. Purely proportional, so it is exact
 * for any formula-based dough. Volume strings are dropped: "1¾ cups + 2 Tbsp"
 * has no meaningful scaled form, and a wrong volume is worse than none.
 */
export function scaleIngredients(ings: readonly Ingredient[], targetTotalG: number): Ingredient[] {
  const current = totalG(ings);
  if (current <= 0) throw new Error('Cannot scale a batch with no weight.');
  const factor = targetTotalG / current;
  return ings.map(({ vol: _vol, ...rest }) => ({ ...rest, g: rest.g * factor }));
}

export function bakersPercents(ings: readonly Ingredient[]): Array<{ item: string; pct: number }> {
  const flour = ings.find(i => i.isFlour);
  if (!flour) throw new Error('No ingredient marked isFlour; cannot compute bakers’ percentages.');
  return ings.map(i => ({ item: i.item, pct: (i.g / flour.g) * 100 }));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/dough.ts src/lib/dough.test.ts
git commit -m "Add proportional dough scaling and bakers' percentages"
```

---

### Task 4: Style bands

**Files:**
- Create: `src/lib/styles.ts`
- Test: `src/lib/styles.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  ```ts
  export type BandTier = 'sourced' | 'extrapolated';
  export interface StyleBand {
    id: string; name: string; min: number; max: number;
    tier: BandTier; note?: string;
  }
  export interface MeasuredPoint { id: string; name: string; tf: number; basis: string; }
  export const SOURCE_URL: string;
  export const BANDS: readonly StyleBand[];
  export const MEASURED: readonly MeasuredPoint[];
  export const SCALE_MIN: number;   // 0.04
  export const SCALE_MAX: number;   // 0.18
  export function bandsFor(tf: number): StyleBand[];
  ```

- [ ] **Step 1: Write the failing tests**

`src/lib/styles.test.ts`:

```ts
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
    BANDS.forEach(b => { expect(b.min).toBeGreaterThanOrEqual(SCALE_MIN); expect(b.max).toBeLessThanOrEqual(SCALE_MAX); });
    MEASURED.forEach(m => { expect(m.tf).toBeGreaterThanOrEqual(SCALE_MIN); expect(m.tf).toBeLessThanOrEqual(SCALE_MAX); });
  });
});

describe('bandsFor', () => {
  it('places recipe 1 in the thin/cracker region', () => {
    const ids = bandsFor(0.0779).map(b => b.id);
    expect(ids).toContain('cracker-crispy');
    expect(ids).toContain('neapolitan-hot');
  });
  it('places NY slice thickness correctly', () => expect(bandsFor(0.092).map(b => b.id)).toContain('ny-slice'));
  it('places deep dish with its lip counted in the deep-dish band', () =>
    expect(bandsFor(0.1105).map(b => b.id)).toContain('chicago-deep-dish'));
  it('returns empty above every band rather than guessing', () => expect(bandsFor(0.30)).toEqual([]));
  it('is inclusive at boundaries', () => expect(bandsFor(0.05).map(b => b.id)).toContain('cracker-crispy'));
});

describe('measured references', () => {
  it("includes both of the portal's recipes", () => {
    const ids = MEASURED.map(m => m.id);
    expect(ids).toContain('recipe-pastry-pizza');
    expect(ids).toContain('recipe-deep-dish-base');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — cannot resolve `./styles`.

- [ ] **Step 3: Implement**

`src/lib/styles.ts`:

```ts
export type BandTier = 'sourced' | 'extrapolated';

export interface StyleBand {
  id: string; name: string; min: number; max: number; tier: BandTier; note?: string;
}
export interface MeasuredPoint { id: string; name: string; tf: number; basis: string; }

export const SOURCE_URL = 'https://www.pizzamaking.com/forum/index.php/topic,39674.0.html';
export const SCALE_MIN = 0.04;
export const SCALE_MAX = 0.18;

/**
 * `sourced` values are quoted from Pete-zza's list in the thread above.
 * `extrapolated` values are inferred to extend coverage and are flagged as such
 * in the UI. Tune these as you bake; nothing else reads the numbers directly.
 */
export const BANDS: readonly StyleBand[] = [
  { id: 'cracker-crispy',    name: 'Cracker, thin & crispy', min: 0.05,  max: 0.08,  tier: 'sourced' },
  { id: 'neapolitan-hot',    name: 'Neapolitan, high-temp',  min: 0.07,  max: 0.08,  tier: 'sourced' },
  { id: 'ny-elite',          name: '"Elite" NY',             min: 0.065, max: 0.085, tier: 'sourced' },
  { id: 'ny-slice',          name: 'NY street / slice',      min: 0.085, max: 0.10,  tier: 'sourced' },
  { id: 'cracker-tender',    name: 'Cracker, thin & tender', min: 0.09,  max: 0.10,  tier: 'sourced' },
  { id: 'neapolitan-home',   name: 'Neapolitan, home oven',  min: 0.095, max: 0.11,  tier: 'sourced' },
  { id: 'chicago-deep-dish', name: 'Chicago deep-dish',      min: 0.11,  max: 0.135, tier: 'sourced' },
  { id: 'sicilian',          name: 'Sicilian',               min: 0.12,  max: 0.15,  tier: 'sourced',
    note: 'Listed as 0.12–0.13, with 0.15 reported.' },
  { id: 'american',          name: 'American',               min: 0.12,  max: 0.14,  tier: 'sourced' },
  { id: 'tavern',            name: 'Tavern / Chicago thin',  min: 0.055, max: 0.075, tier: 'extrapolated',
    note: 'Inferred: sits within the sourced crispy-cracker band.' },
  { id: 'grandma',           name: 'Grandma',                min: 0.10,  max: 0.12,  tier: 'extrapolated',
    note: 'Inferred: between the thin and Sicilian bands.' },
  { id: 'detroit',           name: 'Detroit',                min: 0.12,  max: 0.15,  tier: 'extrapolated',
    note: 'Inferred: Sicilian-adjacent, pan-baked.' },
  { id: 'pan-hut',           name: 'Pizza Hut-style pan',    min: 0.13,  max: 0.16,  tier: 'extrapolated',
    note: 'Inferred: above Sicilian; matches this portal’s pan variation.' },
];

export const MEASURED: readonly MeasuredPoint[] = [
  { id: 'recipe-pastry-pizza',    name: 'Pastry pizza',            tf: 0.0779, basis: '210 g ball at 11″ round' },
  { id: 'recipe-deep-dish-base',  name: 'Deep dish (base only)',   tf: 0.1657, basis: 'publisher’s stated figure, HFUTS = 0' },
  { id: 'recipe-deep-dish-wall',  name: 'Deep dish (1.5″ lip)',    tf: 0.1105, basis: 'same dough, pan wall counted' },
];

/** Bands containing this TF. Several may match; none is a valid answer. */
export const bandsFor = (tf: number): StyleBand[] =>
  BANDS.filter(b => tf >= b.min && tf <= b.max);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/styles.ts src/lib/styles.test.ts
git commit -m "Add style bands, separating sourced from extrapolated values"
```

---

### Task 5: Reference table generator and formatting

**Files:**
- Create: `src/lib/format.ts`
- Modify: `src/lib/dough.ts`
- Test: `src/lib/format.test.ts`

**Interfaces:**
- Consumes: Tasks 2–3
- Produces:
  ```ts
  // dough.ts
  export interface RefTableOpts { ozFrom: number; ozTo: number; ozStep: number; diameters: readonly number[]; }
  export interface RefTable { diameters: readonly number[]; rows: Array<{ oz: number; g: number; tf: number[] }>; }
  export function referenceTable(o: RefTableOpts): RefTable;
  // format.ts
  export function fmtGrams(g: number): string;
  export function fmtTf(tf: number): string;          // "0.078 oz/in²"
  export function fmtTfMetric(tf: number): string;    // "0.343 g/cm²"
  export function fmtIn(n: number): string;
  ```

- [ ] **Step 1: Write the failing tests**

`src/lib/format.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { fmtGrams, fmtTf, fmtTfMetric, fmtIn } from './format';
import { referenceTable } from './dough';

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
});

describe('referenceTable', () => {
  const t = referenceTable({ ozFrom: 8, ozTo: 9, ozStep: 0.5, diameters: [10, 12] });
  it('produces a row per weight step', () => expect(t.rows.map(r => r.oz)).toEqual([8, 8.5, 9]));
  it('reproduces the published worksheet cells', () => {
    expect(+t.rows[0]!.tf[0]!.toFixed(3)).toBe(0.102);  // 8 oz @ 10"
    expect(+t.rows[0]!.tf[1]!.toFixed(3)).toBe(0.071);  // 8 oz @ 12"
    expect(+t.rows[2]!.tf[0]!.toFixed(3)).toBe(0.115);  // 9 oz @ 10"
  });
  it('carries the gram equivalent of each row', () => expect(t.rows[0]!.g).toBeCloseTo(226.8, 1));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — modules/exports missing.

- [ ] **Step 3: Implement**

Append to `src/lib/dough.ts`:

```ts
export interface RefTableOpts {
  ozFrom: number; ozTo: number; ozStep: number; diameters: readonly number[];
}
export interface RefTable {
  diameters: readonly number[];
  rows: Array<{ oz: number; g: number; tf: number[] }>;
}

/**
 * Generated rather than transcribed from the published image, which contains at
 * least one rounding error (30 oz at 20″ prints 0.096; the true value is 0.09549).
 */
export function referenceTable({ ozFrom, ozTo, ozStep, diameters }: RefTableOpts): RefTable {
  const rows: RefTable['rows'] = [];
  const steps = Math.round((ozTo - ozFrom) / ozStep);
  for (let i = 0; i <= steps; i++) {
    const oz = +(ozFrom + i * ozStep).toFixed(4);
    rows.push({
      oz, g: ozToG(oz),
      tf: diameters.map(d => thicknessFactor(oz, { kind: 'round', diameterIn: d })),
    });
  }
  return { diameters, rows };
}
```

`src/lib/format.ts`:

```ts
import { GCM2_PER_OZIN2 } from './dough';

const trim = (s: string): string => s.replace(/\.0+$/, '');

/** Grams at a precision a kitchen scale can actually hit. */
export const fmtGrams = (g: number): string =>
  `${trim(g >= 10 ? g.toFixed(0) : g.toFixed(1))} g`;

/** TF is never shown as a bare number — the unit disambiguates the convention. */
export const fmtTf = (tf: number): string => `${tf.toFixed(3)} oz/in²`;

export const fmtTfMetric = (tf: number): string =>
  `${(tf * GCM2_PER_OZIN2).toFixed(3)} g/cm²`;

export const fmtIn = (n: number): string => `${trim(n.toFixed(2).replace(/0$/, ''))}″`;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS. If `fmtIn(12)` fails, fix the trim chain rather than the test.

- [ ] **Step 5: Commit**

```bash
git add src/lib/format.ts src/lib/format.test.ts src/lib/dough.ts
git commit -m "Add generated reference table and unit-safe formatters"
```

---

### Task 6: Content schema and recipe #1

**Files:**
- Create: `src/content.config.ts`, `src/content/recipes/pastry-pizza-dough.md`
- Test: build-time validation

**Interfaces:**
- Consumes: nothing at runtime
- Produces: collection `recipes`, entries typed as the Zod schema below.

- [ ] **Step 1: Write the schema**

`src/content.config.ts`:

```ts
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const ingredient = z.object({
  item: z.string(),
  g: z.number().nonnegative(),
  vol: z.string().optional(),
  optional: z.boolean().default(false),
  note: z.string().optional(),
  isFlour: z.boolean().default(false),
});

const target = z.object({
  shape: z.enum(['round', 'rect']),
  diameterIn: z.number().positive().optional(),
  lengthIn: z.number().positive().optional(),
  widthIn: z.number().positive().optional(),
  wallIn: z.number().nonnegative().default(0),
  assumed: z.boolean().default(false),
  note: z.string().optional(),
});

const batch = z.object({
  id: z.string(),
  name: z.string(),
  yield: z.string().optional(),
  balls: z.number().int().positive().default(1),
  target: target.optional(),
  note: z.string().optional(),
  ingredients: z.array(ingredient).min(1),
});

const recipes = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/recipes' }),
  schema: z.object({
    title: z.string(),
    blurb: z.string(),
    category: z.enum(['pizza', 'focaccia', 'bread']),
    tags: z.array(z.string()).default([]),
    times: z.object({
      ferment: z.string().optional(),
      rest: z.string().optional(),
      bake: z.string().optional(),
    }).default({}),
    scalable: z.boolean().default(false),
    batches: z.array(batch).min(1),
    credit: z.object({
      text: z.string(),
      url: z.string().url().optional(),
      donateUrl: z.string().url().optional(),
    }).optional(),
    source: z.string().optional(),
    order: z.number().default(0),
  }),
});

export const collections = { recipes };
```

- [ ] **Step 2: Author recipe #1**

`src/content/recipes/pastry-pizza-dough.md` — frontmatter carries all three batches. Ingredient weights and volume strings come verbatim from `.vscode/docs/pastry-pizza-dough-recipe.html`. The `pan` batch reuses the 2-ball ingredient list with `balls: 1`, and its `target` is marked `assumed: true` because the Breville pan diameter is unconfirmed (spec §10).

```markdown
---
title: Pastry-Style Pizza Dough
blurb: A home version of the Pizza Snob dough mix — thin, crisp, and buttery. Cold-fermented 48–72 hours.
category: pizza
tags: [pizza, cold-ferment, thin-crust, breville-pizzaiolo]
order: 1
scalable: true
times: { ferment: "48–72 h cold", rest: "2 h room temp", bake: "1:30–2:00 at 700°F" }
batches:
  - id: two-ball
    name: 2 dough balls
    yield: ~210 g each
    balls: 2
    target: { shape: round, diameterIn: 11 }
    ingredients:
      - { item: All-purpose flour, g: 228, vol: "1¾ cups + 2 Tbsp", isFlour: true }
      - { item: Cornstarch, g: 9, vol: "1 Tbsp" }
      - { item: Sugar, g: 10, vol: "2½ tsp" }
      - { item: Fine salt, g: 4.5, vol: "¾ tsp" }
      - { item: Instant yeast, g: 3.5, vol: "1 heaping tsp" }
      - { item: Xanthan gum, g: 1, vol: "¼ tsp" }
      - { item: Sunflower lecithin powder, g: 2, vol: "¾ tsp", optional: true }
      - { item: Cool water, g: 118, vol: "½ cup" }
      - { item: Olive oil, g: 42, vol: "3 Tbsp", note: "or other oil; see notes" }
  - id: four-ball
    name: 4 dough balls
    yield: ~210 g each
    balls: 4
    target: { shape: round, diameterIn: 11 }
    ingredients:
      - { item: All-purpose flour, g: 456, vol: "3¾ cups", isFlour: true }
      - { item: Cornstarch, g: 18, vol: "2 Tbsp" }
      - { item: Sugar, g: 20, vol: "5 tsp" }
      - { item: Fine salt, g: 9, vol: "1½ tsp" }
      - { item: Instant yeast, g: 7, vol: "2¼ tsp (1 packet)" }
      - { item: Xanthan gum, g: 2, vol: "½ tsp" }
      - { item: Sunflower lecithin powder, g: 4, vol: "1½ tsp", optional: true }
      - { item: Cool water, g: 236, vol: "1 cup" }
      - { item: Olive oil, g: 84, vol: "6 Tbsp", note: "or other oil; see notes" }
  - id: pan
    name: Pan pizza
    yield: one deep-dish crust, ~418 g
    balls: 1
    note: "For a softer, fluffier crumb, add 20 g (4 tsp) extra water when mixing."
    target: { shape: round, diameterIn: 12, wallIn: 1, assumed: true, note: "Breville deep-dish pan size unconfirmed — set your own below." }
    ingredients:
      - { item: All-purpose flour, g: 228, vol: "1¾ cups + 2 Tbsp", isFlour: true }
      - { item: Cornstarch, g: 9, vol: "1 Tbsp" }
      - { item: Sugar, g: 10, vol: "2½ tsp" }
      - { item: Fine salt, g: 4.5, vol: "¾ tsp" }
      - { item: Instant yeast, g: 3.5, vol: "1 heaping tsp" }
      - { item: Xanthan gum, g: 1, vol: "¼ tsp" }
      - { item: Sunflower lecithin powder, g: 2, vol: "¾ tsp", optional: true }
      - { item: Cool water, g: 118, vol: "½ cup" }
      - { item: Olive oil, g: 42, vol: "3 Tbsp", note: "or other oil; see notes" }
source: >-
  Reverse-engineered from the Pizza Snob label: wheat flour, sugar, modified food
  starch, salt, yeast, mono & diglycerides, lecithin, xanthan and guar gum.
  Net wt 257 g per bag; ½ cup water + 3 Tbsp olive oil.
---

## Method

1. Whisk the flour, cornstarch, sugar, salt, yeast, xanthan gum, and lecithin
   together thoroughly. The xanthan must be fully dispersed in the dry mix before
   any liquid is added or it will clump.
2. Stir the olive oil into the water. Pour the liquid into the dry ingredients and
   mix until no dry flour remains.
3. Turn out and knead 3–4 minutes, just until the dough forms a smooth, tight ball.
   It will feel stiff and slightly greasy — that is correct. Do not add water.
4. Coat lightly with oil, seal in a container, and refrigerate 48–72 hours
   (72 recommended).
5. Two hours before baking, divide into balls of about 210 g each, cover, and rest
   at room temperature. The dough should stretch thin with almost no resistance.
6. Stretch or roll each ball to 11 inches, top, and bake.

## Baking — Breville Pizzaiolo (factory presets)

Use the Wood Fired preset. It runs at 700°F, which matches the 650–750°F range
this dough was formulated for.

- Preset: **Wood Fired**. Darkness: middle. Timer: 2:00.
- Preheat fully — wait for the ready indicator, about 20 minutes.
- Launch the pizza on the peel with a light dusting of flour. Check at 1:30; pull
  when the rim is blistered and the underside is well browned. Most bakes finish
  between 1:30 and 2:00.
- If the bottom is darker than you like, drop Darkness one notch and try again —
  do not switch presets.

Alternate, for a cracker-style bar crust: **Thin & Crispy** preset (625°F),
Darkness middle, Timer 4:00; check at 3:30.

## Pan Pizza — one bag, Breville deep-dish pan

For a Pizza Hut–style pan pizza, use one full bag (or the 2-ball batch, ~418 g of
dough) as a single crust in the Pizzaiolo's included pan. Note that this is a
low-hydration, high-oil dough, so the result will be crisper and a bit denser than
a true Pizza Hut crust. For a softer, fluffier crumb, add 20 g (4 tsp) extra water
when mixing.

1. Ferment the dough as usual (48–72 hours cold). Do not divide it.
2. Grease the pan with 2–3 Tbsp butter-flavored Crisco: soften it, spread with your
   fingers over the base and up the sides, and leave it a little thicker around the
   outer edge. The crust essentially fries in this layer, which is where the Pizza
   Hut flavor and crunch come from. Plain shortening or vegetable oil works;
   butter-flavored adds the familiar note.
3. Press the cold dough into a rough disc, drop it in the pan, and press it out to
   the edges with oiled fingertips. If it resists, cover and wait 15 minutes, then
   finish pressing.
4. Cover and proof at room temperature 90 minutes to 2 hours, until noticeably
   puffy. This replaces the usual 2-hour rest.
5. Top it: a thin layer of sauce, then cheese all the way to the pan edge so it
   browns against the metal, then toppings.
6. Preheat the Pizzaiolo on the **Pan** preset (475°F), Darkness middle. Bake 12–14
   minutes; check at 10. Pull when the edge is deep golden and the cheese is
   bubbling.
7. Rest 2 minutes in the pan so the crust firms and releases, then slide out onto a
   rack or board and cut.

If the top browns before the bottom crisps, drop Darkness one notch and add 1–2
minutes. Use the full 4-ball batch for two pan pizzas.

## Notes

- Mix and ferment as one mass; divide into balls after the fridge, at the start of
  the room-temperature rest.
- Freezes well after fermenting: weigh out balls, wrap tightly, freeze. Thaw
  overnight in the fridge, then give the full 2-hour rest.
- Flour: standard all-purpose (about 10.5–11.7% protein) is closest to the mix.
  Bread flour works but gives a chewier, springier crust; if using it, raise the
  cornstarch to 15 g per 228 g flour (about 1½ Tbsp) and ferment the full 72 hours.
  Avoid pastry or cake flour.
- Oil: any oil works at the same weight — 42 g or 84 g. Olive oil (light or "pure"
  is closer to neutral than extra-virgin) gives a grassy, peppery note; corn oil
  turns fried and popcorn-like at 700°F; canola is the most neutral. At 18% of
  flour weight the oil is a foreground flavor, so it is worth testing side by side.
- Bakers' ratios, relative to flour: ~52% water, ~18% oil, ~4.5% sugar, ~2% salt,
  ~1.5% yeast, ~4% cornstarch.
```

- [ ] **Step 3: Verify the schema accepts it and rejects bad data**

Run: `npm run build`
Expected: build succeeds.

Then temporarily change `g: 228` to `g: "228"` and re-run.
Expected: build FAILS with a Zod error naming the field. Revert the change.

- [ ] **Step 4: Commit**

```bash
git add src/content.config.ts src/content/recipes/pastry-pizza-dough.md
git commit -m "Add typed recipe collection schema and pastry pizza dough"
```

---

### Task 7: Recipe #2 — Real Deep Dish "Holy Grail"

**Files:**
- Create: `src/content/recipes/real-deep-dish-holy-grail.md`

**Interfaces:**
- Consumes: Task 6's schema
- Produces: a second collection entry, four batches

**Attribution requirement:** this is third-party content. `credit` must carry the
author's name, `https://www.realdeepdish.com/`, and the donation link the source
PDF asks for. The method below is condensed into functional steps; the original
prose is not reproduced.

- [ ] **Step 1: Author the recipe**

Weights are the source's own. **The 14″ entry uses 724.4 g, the sum of its own
ingredient list — the source PDF's "732 grams" header contradicts it (spec §2.2).**
Note this in `note:` rather than silently correcting.

```markdown
---
title: Real Deep Dish "Holy Grail"
blurb: Authentic Chicago deep dish — a buttery, biscuit-like crust with a paper-thin lip pinched up the pan.
category: pizza
tags: [pizza, chicago, deep-dish, pan]
order: 2
scalable: true
times: { ferment: "1–2 h rise, or up to 48 h cold", bake: "~35 min at 450°F" }
batches:
  - id: nine-inch
    name: 9″ pan
    yield: one crust, ~300 g
    balls: 1
    target: { shape: round, diameterIn: 9, wallIn: 1.25 }
    ingredients:
      - { item: All-purpose flour, g: 176, vol: "1.4 cups", isFlour: true }
      - { item: Water (110°F), g: 90, vol: "3.1 fluid ounces" }
      - { item: Vegetable or corn oil, g: 30.3, vol: "2.25 Tablespoons" }
      - { item: Instant (IDY) yeast, g: 1.8, vol: "0.6 teaspoons" }
      - { item: Fine sea salt, g: 1, vol: "0.14 teaspoons", optional: true }
      - { item: Sugar, g: 0.7, vol: "0.14 teaspoons", optional: true }
  - id: ten-inch
    name: 10″ pan
    yield: one crust, ~369 g
    balls: 1
    target: { shape: round, diameterIn: 10, wallIn: 1.25 }
    ingredients:
      - { item: All-purpose flour, g: 217, vol: "1.75 cups", isFlour: true }
      - { item: Water (110°F), g: 111, vol: "4 fluid ounces" }
      - { item: Vegetable or corn oil, g: 37.5, vol: "2.8 Tablespoons" }
      - { item: Instant (IDY) yeast, g: 2.2, vol: "0.7 teaspoons (¼ Tbsp)" }
      - { item: Fine sea salt, g: 1, vol: "0.175 teaspoons", optional: true }
      - { item: Sugar, g: 0.7, vol: "0.175 teaspoons", optional: true }
  - id: twelve-inch
    name: 12″ pan
    yield: one crust, ~531 g
    balls: 1
    note: "The size the recipe is written for. Its published thickness factor is 0.1657 oz/in², measured on the pan base only."
    target: { shape: round, diameterIn: 12, wallIn: 1.25 }
    ingredients:
      - { item: All-purpose flour, g: 312.5, vol: "2½ cups", isFlour: true }
      - { item: Water (110°F), g: 159.3, vol: "⅔ cup plus 2 tsp (5.6 fluid oz)" }
      - { item: Vegetable or corn oil, g: 54, vol: "4 Tablespoons (¼ cup)" }
      - { item: Instant (IDY) yeast, g: 3.1, vol: "1 teaspoon" }
      - { item: Fine sea salt, g: 1.4, vol: "¼ teaspoon", optional: true }
      - { item: Sugar, g: 1, vol: "¼ teaspoon", optional: true }
  - id: fourteen-inch
    name: 14″ pan
    yield: one crust, ~724 g
    balls: 1
    note: "The source lists this batch as 732 g, but its own ingredient weights sum to 724.4 g. The ingredient weights are used here, which keeps this size's thickness factor consistent with the other three."
    target: { shape: round, diameterIn: 14, wallIn: 1.25 }
    ingredients:
      - { item: All-purpose flour, g: 426, vol: "3.4 cups", isFlour: true }
      - { item: Water (110°F), g: 217.3, vol: "7.7 fluid ounces" }
      - { item: Vegetable or corn oil, g: 73.5, vol: "5.4 Tablespoons" }
      - { item: Instant (IDY) yeast, g: 4.3, vol: "1.4 teaspoons (½ Tbsp)" }
      - { item: Fine sea salt, g: 1.9, vol: "0.34 teaspoons", optional: true }
      - { item: Sugar, g: 1.4, vol: "0.34 teaspoons", optional: true }
credit:
  text: Recipe by Real Deep Dish. Reproduced here for personal use with thanks.
  url: https://www.realdeepdish.com/
  donateUrl: https://cash.app/$realdeepdish
source: >-
  Chicago Style Deep Dish Pizza – The Real Thing, realdeepdish.com. Bakers'
  percentages and gram weights are the author's own. If you use this recipe,
  consider supporting the author.
---

## Hardware

- A round deep-dish pizza or cake pan, 2″ deep — aluminized steel or dark non-stick.
- A pizza stone on the bottom rack (optional, recommended).
- A fine mesh strainer and bowl, for draining the tomatoes.
- A pan gripper, and a spatula for serving.

## Toppings

Brands are suggestions, not requirements.

- **Mozzarella**, low-moisture part-skim or whole milk, **sliced** — 16 to 20 oz.
  Sliced, not shredded; you need enough to cover the base completely.
- **Italian sausage**, mild or hot, raw, removed from its casing — ¾ to 1 lb.
- **Crushed tomatoes**, canned — 14 to 16 fl oz. Drain if watery.
- **Dried sweet basil**, pepperoni, sliced vegetables, and grated Romano or
  Parmesan (⅛ cup or less) — all optional.

## Part One: Making the dough

1. Dissolve the sugar and salt into the lukewarm water.
2. Add the yeast, oil, and a small amount of the flour; mix to a thick batter.
3. Add the rest of the flour and mix until combined.
4. Knead just until the dough comes together into a smooth ball, then stop. Two to
   three minutes by hand, one to two in a mixer with a dough hook. A little shaggy
   is fine — do not over-knead.
5. Lightly oil the ball, cover, and rise in a warm place 1 to 2 hours, until doubled.
6. Use immediately, or punch down and repeat, or refrigerate up to 48 hours. Bring
   close to room temperature before using.

## Part Two: Assembling and baking

1. Put the stone on the bottom rack and a sheet of heavy foil on the top rack.
   Preheat to 500°F — allow 40–60 minutes for the stone.
2. Grease the pan base (not the sides) with oil, shortening, or high-heat spray.
3. Press the dough from the centre out, as flat and even as possible, then pinch a
   paper-thin lip 1 to 1½ inches up the sides.
4. Press the sliced mozzarella into the dough, overlapping, until the base is
   covered.
5. For sausage: scatter small bits over the cheese in a loose connected web. Add
   anything else you want protected from the heat now.
6. Spoon the crushed tomatoes from the centre outward until everything is covered.
7. Sprinkle the grated Romano sparingly over the sauce, like snow.
8. Turn the oven down to 450°F and place the pan directly on the stone.
9. Bake about 35 minutes. If the top starts to char, lay foil loosely over it.
10. Rest 5 minutes, then cut and serve.

## Notes

- High-moisture vegetables such as peppers and onions are best added in the last
  15 minutes of the bake.
- For an all-cheese deep dish, add more cheese and skip straight to the tomatoes.
- For Gino's-style yellow dough, add ½ tsp cream of tartar and a few drops of
  yellow food colour.
- For a quicker rise, use up to a whole packet of instant yeast (about 2¼ tsp).
```

- [ ] **Step 2: Verify the computed TF matches the publisher's figure**

Run: `npm run build`, then in a node REPL or a scratch test:
`tfFromGrams(531.3, { kind: 'round', diameterIn: 12 })` → expect ≈ 0.1657.
This is already asserted by Task 2's test suite; confirm it still passes.

- [ ] **Step 3: Commit**

```bash
git add src/content/recipes/real-deep-dish-holy-grail.md
git commit -m "Add Real Deep Dish Holy Grail recipe with attribution"
```

---

### Task 8: Design tokens, base layout, and theme toggle

**Files:**
- Create: `src/styles/tokens.css`, `src/styles/base.css`, `src/layouts/BaseLayout.astro`, `src/components/ThemeToggle.astro`

**Interfaces:**
- Consumes: nothing
- Produces: `BaseLayout` with props `{ title: string; description: string }`; CSS custom properties consumed by every later component; `html.js` class and `data-theme` attribute contract.

**Design direction:** warm near-black grounds with an ember accent, echoing oven
heat rather than generic slate-grey dark mode. System font stack (zero network
requests, which protects the performance score), with negative letter-spacing on
headings and **tabular figures on every quantity** so ingredient columns align.

- [ ] **Step 1: Write the token sheet**

`src/styles/tokens.css`. Light values are defined on bare `:root` and overridden
for dark, but **dark is what ships by default** because `BaseLayout` stamps
`data-theme="dark"` on the html element.

```css
:root {
  --bg: #faf7f0;
  --surface: #ffffff;
  --surface-raised: #f4efe4;
  --border: #ded5c3;
  --border-strong: #c3b79e;
  --text: #1c1915;
  --text-muted: #5a5347;
  --accent: #8a5a0b;
  --accent-hover: #6d4708;
  --accent-contrast: #ffffff;
  --focus: #0b57d0;
  --tier-sourced: #14532d;
  --tier-extrapolated: #78350f;

  --font-sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;

  --step-0: clamp(0.95rem, 0.92rem + 0.15vw, 1.05rem);
  --step-1: clamp(1.15rem, 1.08rem + 0.35vw, 1.4rem);
  --step-2: clamp(1.45rem, 1.3rem + 0.7vw, 1.95rem);
  --step-3: clamp(1.9rem, 1.6rem + 1.4vw, 2.9rem);

  --space-1: 0.35rem; --space-2: 0.6rem;  --space-3: 1rem;
  --space-4: 1.6rem;  --space-5: 2.5rem;  --space-6: 4rem;

  --radius: 10px;
  --measure: 68ch;
  --shadow: 0 1px 2px rgb(0 0 0 / 0.06), 0 8px 24px -12px rgb(0 0 0 / 0.18);
}

:root[data-theme="dark"] {
  --bg: #12100e;
  --surface: #1a1714;
  --surface-raised: #23201a;
  --border: #322d25;
  --border-strong: #4a4235;
  --text: #f3eee4;
  --text-muted: #a99f8e;
  --accent: #f0ac48;
  --accent-hover: #ffc164;
  --accent-contrast: #1c1409;
  --focus: #9ec3ff;
  --tier-sourced: #86efac;
  --tier-extrapolated: #fcd34d;
  --shadow: 0 1px 2px rgb(0 0 0 / 0.5), 0 10px 30px -12px rgb(0 0 0 / 0.7);
}
```

- [ ] **Step 2: Write the base sheet**

`src/styles/base.css` — reset, typography, focus, skip link, `.visually-hidden`,
tabular figures on `.num`, and the reduced-motion guard.

```css
*, *::before, *::after { box-sizing: border-box; }
html { color-scheme: light; }
html[data-theme="dark"] { color-scheme: dark; }
body {
  margin: 0; background: var(--bg); color: var(--text);
  font-family: var(--font-sans); font-size: var(--step-0); line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}
h1, h2, h3 { line-height: 1.15; letter-spacing: -0.02em; margin: 0 0 var(--space-3); text-wrap: balance; }
h1 { font-size: var(--step-3); } h2 { font-size: var(--step-2); } h3 { font-size: var(--step-1); }
p, li { max-width: var(--measure); }
a { color: var(--accent); text-underline-offset: 0.2em; }
:focus-visible { outline: 3px solid var(--focus); outline-offset: 2px; border-radius: 4px; }
.num { font-variant-numeric: tabular-nums; }
.visually-hidden {
  position: absolute; width: 1px; height: 1px; overflow: hidden;
  clip-path: inset(50%); white-space: nowrap;
}
.skip-link {
  position: absolute; left: var(--space-3); top: -4rem; z-index: 10;
  background: var(--accent); color: var(--accent-contrast);
  padding: var(--space-2) var(--space-3); border-radius: var(--radius);
  transition: top 120ms ease;
}
.skip-link:focus { top: var(--space-3); }
.wrap { width: min(100% - 2rem, 68rem); margin-inline: auto; }
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
```

- [ ] **Step 3: Write BaseLayout with the no-flash script**

`src/layouts/BaseLayout.astro`. The inline script runs before paint: it applies a
stored preference and marks the document as JS-capable so components can reveal
controls that would otherwise be inert.

```astro
---
import '../styles/tokens.css';
import '../styles/base.css';
import '../styles/print.css';
import ThemeToggle from '../components/ThemeToggle.astro';
interface Props { title: string; description: string; }
const { title, description } = Astro.props;
---
<!doctype html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{title}</title>
  <meta name="description" content={description} />
  <script is:inline>
    (function () {
      try {
        var t = localStorage.getItem('theme');
        if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
      } catch (e) {}
      document.documentElement.classList.add('js');
    })();
  </script>
</head>
<body>
  <a class="skip-link" href="#main">Skip to content</a>
  <header class="site-header">
    <div class="wrap site-header__inner">
      <a class="site-header__brand" href="/">Pizza Portal</a>
      <nav aria-label="Main"><a href="/tools/dough-calculator">Dough calculator</a></nav>
      <ThemeToggle />
    </div>
  </header>
  <main id="main"><slot /></main>
  <footer class="site-footer"><div class="wrap"><p>Recipes and dough maths for pizza and bread.</p></div></footer>
</body>
</html>
```

- [ ] **Step 4: Write ThemeToggle**

`src/components/ThemeToggle.astro`. The button is `hidden` in markup and revealed
by its own script, so a no-JS visitor never sees a dead control.

```astro
<button type="button" id="theme-toggle" class="theme-toggle" aria-pressed="true" hidden>
  <span aria-hidden="true" class="theme-toggle__icon"></span>
  <span class="theme-toggle__text">Dark mode</span>
</button>

<script>
  const btn = document.getElementById('theme-toggle');
  if (btn) {
    btn.hidden = false;
    const sync = () => {
      const dark = document.documentElement.dataset.theme !== 'light';
      btn.setAttribute('aria-pressed', String(dark));
      const label = btn.querySelector('.theme-toggle__text');
      if (label) label.textContent = 'Dark mode';
    };
    sync();
    btn.addEventListener('click', () => {
      const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem('theme', next); } catch (e) {}
      sync();
    });
  }
</script>
```

- [ ] **Step 5: Create a placeholder print sheet so the import resolves**

`src/styles/print.css` with `@media print { }` for now; Task 13 fills it.

- [ ] **Step 6: Verify**

Run: `npm run build`
Expected: builds clean. Open dev server, toggle theme, reload — preference sticks
with no flash of the wrong theme.

- [ ] **Step 7: Commit**

```bash
git add src/styles src/layouts src/components/ThemeToggle.astro
git commit -m "Add design tokens, base layout and no-flash theme toggle"
```

---

### Task 9: Home page and cards

**Files:**
- Create: `src/pages/index.astro`, `src/components/RecipeCard.astro`, `src/components/ToolCard.astro`

**Interfaces:**
- Consumes: `BaseLayout`, `getCollection('recipes')`, `tfFromGrams`, `totalG`, `fmtTf`
- Produces: nothing consumed later

- [ ] **Step 1: Build RecipeCard**

Props: `{ slug: string; title: string; blurb: string; category: string; times: {...}; tf: number | null }`.

The whole card is one link. Implement with a stretched pseudo-element over the
card so the visible target is large but the accessible name stays the title:

```css
.card { position: relative; }
.card__title a::after { content: ''; position: absolute; inset: 0; }
```

Do **not** add extra anchors inside the card — that would break the single-target rule.

Show the recipe's thickness factor as a chip, formatted with `fmtTf`.

- [ ] **Step 2: Build the index page**

```astro
---
import { getCollection } from 'astro:content';
import BaseLayout from '../layouts/BaseLayout.astro';
import RecipeCard from '../components/RecipeCard.astro';
import ToolCard from '../components/ToolCard.astro';
import { tfFromGrams, totalG, type Shape } from '../lib/dough';

const recipes = (await getCollection('recipes')).sort((a, b) => a.data.order - b.data.order);

const cards = recipes.map((r) => {
  const b = r.data.batches[0]!;
  let tf: number | null = null;
  if (b.target) {
    const shape = (b.target.shape === 'round'
      ? { kind: 'round', diameterIn: b.target.diameterIn!, wallIn: 0 }
      : { kind: 'rect', lengthIn: b.target.lengthIn!, widthIn: b.target.widthIn!, wallIn: 0 }) as Shape;
    tf = tfFromGrams(totalG(b.ingredients) / b.balls, shape);
  }
  return { slug: r.id, ...r.data, tf };
});
---
<BaseLayout title="Pizza Portal" description="Pizza and bread recipes, with the dough maths worked out.">
  <div class="wrap hero">
    <h1>Pizza Portal</h1>
    <p class="hero__lede">Recipes for pizza and bread, each with its dough thickness worked out — and a calculator to scale any of them to the pan you actually own.</p>
  </div>
  <div class="wrap">
    <ul class="grid" role="list">
      {cards.map((c) => <li><RecipeCard {...c} /></li>)}
      <li><ToolCard /></li>
    </ul>
  </div>
</BaseLayout>
```

Note the card TF uses `wallIn: 0` so the home page shows the conventional
base-only figure; the recipe page shows both readings.

- [ ] **Step 3: Style the grid**

`grid-template-columns: repeat(auto-fill, minmax(min(100%, 19rem), 1fr))`, gap
`var(--space-4)`, list-style none, padding 0. Verify at 320px that nothing
overflows horizontally.

- [ ] **Step 4: Verify**

Run: `npm run build && npm run preview`
Expected: three cards; each is keyboard-focusable exactly once; tab order is
title order.

- [ ] **Step 5: Commit**

```bash
git add src/pages/index.astro src/components/RecipeCard.astro src/components/ToolCard.astro
git commit -m "Add home page card grid"
```

---

### Task 10: Recipe page — static rendering

**Files:**
- Create: `src/pages/recipes/[...slug].astro`, `src/components/BatchTable.astro`, `src/components/TfReadout.astro`

**Interfaces:**
- Consumes: collection entries, `dough.ts`, `styles.ts`, `format.ts`
- Produces: DOM contract used by Task 11 — `[data-batch-panel="<id>"]`, `table[data-unit]`, `.col-vol`

This task renders **everything visible with no JavaScript at all**. Task 11 adds
switching on top.

- [ ] **Step 1: Build TfReadout**

Props `{ tf: number; wallTf?: number | null; assumed?: boolean }`. Renders the TF
with `fmtTf`, the metric equivalent with `fmtTfMetric`, and the matching band
names from `bandsFor`. Each band shows its tier as **text**, not colour alone:
`sourced` renders "cited"; `extrapolated` renders "inferred" plus its note as a
`<abbr>`-style hint. When `wallTf` is given, render both readings in a two-row
definition list labelled "base only" and "pan wall counted".

- [ ] **Step 2: Build BatchTable**

Props `{ batch: Batch }`. Renders:

```astro
<section class="batch" data-batch-panel={batch.id} aria-labelledby={`b-${batch.id}`}>
  <h3 id={`b-${batch.id}`}>{batch.name}</h3>
  {batch.yield && <p class="batch__yield">{batch.yield}</p>}
  <TfReadout ... />
  {batch.note && <p class="batch__note">{batch.note}</p>}
  <table data-unit="both">
    <caption class="visually-hidden">Ingredients for {batch.name}</caption>
    <thead><tr>
      <th scope="col">Ingredient</th>
      <th scope="col" class="num">Weight</th>
      <th scope="col" class="col-vol">Volume</th>
    </tr></thead>
    <tbody>
      {batch.ingredients.map((i) => (
        <tr>
          <th scope="row">{i.item}{i.optional && <span class="opt"> (optional)</span>}{i.note && <span class="opt"> — {i.note}</span>}</th>
          <td class="num">{fmtGrams(i.g)}</td>
          <td class="col-vol">{i.vol ?? '—'}</td>
        </tr>
      ))}
    </tbody>
    <tfoot><tr><th scope="row">Total dough</th><td class="num">{fmtGrams(totalG(batch.ingredients))}</td><td class="col-vol"></td></tr></tfoot>
  </table>
</section>
```

- [ ] **Step 3: Build the route**

`getStaticPaths` over the collection; render header, all `BatchTable`s, then
`<Content />` for the Markdown body, then credit and source blocks. The credit
block renders the attribution text, a link to `credit.url`, and the donation link
when present.

- [ ] **Step 4: Verify with JavaScript disabled**

Run: `npm run build && npm run preview`, disable JS in the browser.
Expected: every batch table visible, both weight and volume columns present, no
controls shown, page fully readable.

- [ ] **Step 5: Commit**

```bash
git add src/pages/recipes src/components/BatchTable.astro src/components/TfReadout.astro
git commit -m "Render recipe pages, fully functional without JavaScript"
```

---

### Task 11: Recipe page — batch and unit switching

**Files:**
- Create: `src/components/SegmentedControl.astro`, `src/components/RecipeControls.astro`
- Modify: `src/pages/recipes/[...slug].astro`

**Interfaces:**
- Consumes: Task 10's DOM contract
- Produces: `data-active-batch` on the controls root

- [ ] **Step 1: Build SegmentedControl**

Native radios in a `<fieldset>` with a `<legend>`, visually styled as a segmented
track. Native radios give arrow-key navigation and correct screen-reader
announcement for free — do not rebuild this with buttons and `role="radiogroup"`.

```astro
---
interface Props { name: string; legend: string; options: Array<{ value: string; label: string }>; value: string; }
const { name, legend, options, value } = Astro.props;
---
<fieldset class="seg">
  <legend>{legend}</legend>
  <div class="seg__track">
    {options.map((o) => (
      <>
        <input type="radio" class="seg__input visually-hidden" name={name} id={`${name}-${o.value}`} value={o.value} checked={o.value === value} />
        <label class="seg__label" for={`${name}-${o.value}`}>{o.label}</label>
      </>
    ))}
  </div>
</fieldset>
```

Style `.seg__input:focus-visible + .seg__label` with the focus ring, and
`.seg__input:checked + .seg__label` with the accent — **never colour alone**; the
checked segment also gets a heavier weight and a border.

- [ ] **Step 2: Build RecipeControls, hidden until JS runs**

```astro
<div class="controls" id="recipe-controls" hidden>
  <SegmentedControl name="batch" legend="Batch" options={batchOptions} value={batchOptions[0].value} />
  <SegmentedControl name="unit" legend="Units" options={[{value:'both',label:'Both'},{value:'g',label:'Grams'},{value:'vol',label:'Volume'}]} value="both" />
</div>
```

- [ ] **Step 3: Wire it up**

```astro
<script>
  const root = document.getElementById('recipe-controls');
  if (root) {
    root.hidden = false;
    const panels = Array.from(document.querySelectorAll('[data-batch-panel]'));
    const showBatch = (id) => panels.forEach((p) => { p.hidden = p.dataset.batchPanel !== id; });
    const showUnit = (u) => document.querySelectorAll('table[data-unit]').forEach((t) => { t.dataset.unit = u; });

    const first = panels[0];
    if (first) showBatch(first.dataset.batchPanel);

    root.addEventListener('change', (e) => {
      const t = e.target;
      if (!(t instanceof HTMLInputElement)) return;
      if (t.name === 'batch') showBatch(t.value);
      if (t.name === 'unit') showUnit(t.value);
    });
  }
</script>
```

- [ ] **Step 4: Add the column-hiding CSS**

```css
html.js table[data-unit="g"] .col-vol,
html.js table[data-unit="vol"] .num:not(th) { display: none; }
```

- [ ] **Step 5: Verify both modes**

With JS: only the selected batch shows; arrow keys move between segments; unit
switch hides the right column.
Without JS: all batches show, both columns, no controls.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "Add batch and unit switching as progressive enhancement"
```

---

### Task 12: Recipe page — scale to my pan

**Files:**
- Create: `src/components/ScalePanel.astro`
- Modify: `src/components/RecipeControls.astro`

**Interfaces:**
- Consumes: `dough.ts` (`scaleIngredients`, `tfFromGrams`, `doughWeightOz`, `ozToG`), `styles.ts` (`bandsFor`, `BANDS`), `format.ts`
- Produces: nothing consumed later

- [ ] **Step 1: Add the "Scale to my pan" option**

Append `{ value: '__scale', label: 'Scale to my pan' }` to the batch options in
`RecipeControls`. Selecting it hides all batch panels and reveals `ScalePanel`.

- [ ] **Step 2: Build ScalePanel markup**

Inputs, every one labelled: shape (round / rectangular), diameter **or** length
and width, wall height, style (a `<select>` built from `BANDS`, with tier shown
in the option text — e.g. "Detroit (inferred)"), and number of crusts. Results
land in a container with `aria-live="polite"` and `aria-atomic="true"`.

The panel is `hidden` in markup. Serialise the source batch's ingredients into
the page with `<script type="application/json" id="scale-source">` so the client
script has typed data without refetching.

- [ ] **Step 3: Wire the computation**

On any input change: build the `Shape`, take the selected band's midpoint as the
target TF, compute `doughWeightOz(tf, shape)` → grams per crust → multiply by the
crust count → `scaleIngredients(source, totalTarget)`, then rewrite the results
table. Show per-crust weight, total weight, and the achieved TF via `TfReadout`'s
markup.

Because volume strings cannot be scaled, the results table renders **grams only**
and carries a visible note: "Volume measures are not shown when scaling — they
cannot be converted reliably. Use a scale."

- [ ] **Step 4: Guard the inputs**

Reject non-positive or non-finite sizes by leaving the previous result in place
and rendering a message into the live region. Do not throw, and do not render
`NaN`.

- [ ] **Step 5: Verify against a known value**

Set round / 11″ / wall 0 / style "Neapolitan, high-temp" / 2 crusts.
Expected: about 210 g per ball — matching the recipe's own tested batch.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "Add scale-to-pan mode on recipe pages"
```

---

### Task 13: Dough calculator page

**Files:**
- Create: `src/pages/tools/dough-calculator.astro`, `src/components/StyleScale.astro`, `src/components/ReferenceTable.astro`

**Interfaces:**
- Consumes: all of `dough.ts`, `styles.ts`, `format.ts`
- Produces: nothing consumed later

- [ ] **Step 1: Render the static content first**

Formula, the three band tables from spec §4 (sourced / extrapolated / measured,
each labelled by tier in text), and `ReferenceTable` generated by
`referenceTable({ ozFrom: 8, ozTo: 35, ozStep: 0.5, diameters: [9,10,11,12,13,14,16,18,20,22,24] })`.

Wrap the reference table in `<div class="scroll-x" tabindex="0" role="region" aria-label="Thickness factor reference table">` so it is scrollable **and** keyboard-reachable on narrow screens.

- [ ] **Step 2: Build StyleScale**

A horizontal scale from `SCALE_MIN` to `SCALE_MAX` with band extents marked and
measured points plotted. Every band is labelled in text; tier is conveyed by a
text suffix and a distinct border style, never colour alone. Give the whole
figure a `<figcaption>` describing what it shows, and render the same information
as a plain list for screen readers.

- [ ] **Step 3: Add the solver, hidden until JS runs**

A `<form>` (never submitted; `e.preventDefault()`) containing a `SegmentedControl`
named `solve` with options **Dough weight**, **Pizza size**, **Thickness factor**.
Show only the inputs the chosen mode needs; results into `aria-live="polite"`.

Every result shows the TF in both units — `fmtTf` and `fmtTfMetric` — and when
wall height is greater than zero, shows base-only and wall-included readings side
by side.

- [ ] **Step 4: Verify the three modes**

- Dough weight: round 12″, wall 0, TF 0.1657 → **531 g** (matches Real Deep Dish).
- Thickness factor: 210 g, round 11″, wall 0 → **0.078 oz/in²**.
- Pizza size: 15.39 oz at TF 0.10 → **14″**.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "Add dough thickness calculator page"
```

---

### Task 14: Print stylesheet

**Files:**
- Modify: `src/styles/print.css`
- Modify: `src/components/RecipeControls.astro` (add the Print button)

- [ ] **Step 1: Write the print rules**

```css
@page { size: letter; margin: 0.6in; }

@media print {
  html, body { background: #fff !important; color: #000 !important; }
  .site-header, .site-footer, .controls, .scale-panel, .theme-toggle,
  .skip-link, .print-button, .style-scale { display: none !important; }

  /* Every batch and both unit columns come back, whatever the screen showed. */
  [data-batch-panel] { display: block !important; }
  table[data-unit] .col-vol, table[data-unit] .num { display: table-cell !important; }

  .batch, .recipe-prose h2, table, figure { break-inside: avoid; }
  h2, h3 { break-after: avoid; }
  a { color: #000 !important; text-decoration: underline; }
  .recipe-credit a[href]::after { content: " (" attr(href) ")"; font-size: 0.85em; word-break: break-all; }
  main { font-size: 11.5pt; }
}
```

- [ ] **Step 2: Add the Print button**

Inside the JS-gated `.controls` container, so no-JS visitors are not shown a
button that needs a script:

```astro
<button type="button" class="print-button" onclick="window.print()">Print recipe</button>
```

Replace the inline handler with an `addEventListener` in the controls script to
keep the page CSP-clean.

- [ ] **Step 3: Verify**

Open a recipe, switch to the 4-ball batch and grams-only, then print to PDF.
Expected: **all** batches present, **both** columns present, no nav, no controls,
no section split awkwardly across a page break.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "Add print stylesheet that expands every batch"
```

---

### Task 15: Accessibility and performance verification

**Files:**
- Modify: whatever the audits find
- Create: `docs/verification/2026-09-09-audit.md`

This task is not done when the code is written; it is done when the numbers come
back clean.

- [ ] **Step 1: Serve a production build**

```bash
npm run build && npm run preview -- --port 4321
```

Audit the built output, not the dev server — dev has unbundled assets that skew
performance results.

- [ ] **Step 2: Run the accessibility gates on all three routes**

For `/`, `/recipes/pastry-pizza-dough`, `/recipes/real-deep-dish-holy-grail`, and
`/tools/dough-calculator`:

- lightcap `run_a11y` — must report **100**
- axecap `audit_url` — must report **zero violations**
- contrastcap `check_page_contrast` — **zero failures**, run once per theme

- [ ] **Step 3: Fix what they report, then re-run**

Re-run the failing tool after each fix. Do not batch fixes blindly; a contrast
fix in one theme can break the other, so re-check both.

- [ ] **Step 4: Run the performance audit**

lightcap `run_audit` on each route. Record performance, best-practices, and SEO.
Investigate anything below 95; a static site with no web fonts and no framework
should score at or near 100.

- [ ] **Step 5: Capture screenshots**

viewcap `take_screenshot` at 320, 768, and 1440 for every route, in **both**
themes. Confirm no horizontal scrollbar at 320 and that the reference table
scrolls inside its own container rather than the page.

- [ ] **Step 6: Manual keyboard pass**

Tab through every route. Confirm: the skip link appears on first Tab; focus is
always visible; arrow keys move within each segmented control; no focus trap; the
scale panel's live region announces new results.

- [ ] **Step 7: Record the results**

Write `docs/verification/2026-09-09-audit.md` with each route, each tool, and the
actual scores. Record real numbers — if something is at 98 rather than 100, say
so and say why.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "Verify accessibility and performance across all routes"
```

---

## Self-Review

**Spec coverage.** §2 formula → Task 2. §2.2 verified figures → Tasks 2–3 test
fixtures. §2.3 unit trap → Task 5 `fmtTf`/`fmtTfMetric`, Task 13 dual display.
§2.4 pan walls → Task 2 `areaIn2` wall term, Tasks 10/12/13 dual readings.
§3.2 schema → Task 6. §3.3 engine API → Tasks 2, 3, 5. §4 bands → Task 4, shown
in Tasks 10 and 13. §5.1 home → Task 9. §5.2 recipe page → Tasks 10–12.
§5.3 calculator → Task 13. §6 theme → Task 8. §7 print → Task 14.
§8 accessibility → constraints on every task, verified in Task 15. §9 non-goals →
nothing implements search or filtering. §10 open items → Breville pan marked
`assumed: true` in Task 6; the 732 g discrepancy noted in Task 7.

**Placeholder scan.** No TBDs. Every code step carries real code. Task 15's
"fix what they find" is inherently discovered work, but its gates are exact
numbers, not judgement calls.

**Type consistency.** `Shape`, `Ingredient`, `StyleBand`, `MeasuredPoint`,
`RefTable` are defined once in Tasks 2–5 and used with those exact names
afterwards. `tfFromGrams` is used throughout for gram inputs; `thicknessFactor`
takes ounces. `totalG` is the single source of batch weight. The DOM contract
(`[data-batch-panel]`, `table[data-unit]`, `.col-vol`, `html.js`) is established
in Tasks 8 and 10 and consumed unchanged in Tasks 11, 12, and 14.
