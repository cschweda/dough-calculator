/**
 * Dough thickness maths, after the method documented at
 * https://www.pizzamaking.com/forum/index.php/topic,39674.0.html
 *
 * The method is defined in ounces and inches. Everything here computes in those
 * units and converts at the boundary, because mixing centimetres into this
 * formula is a documented way to get wrong answers.
 */

/** Grams per ounce, as the source method specifies. */
export const G_PER_OZ = 28.35;

/** 1 oz/in² expressed in g/cm² — the source thread's folk fix of "divide by ~4.5". */
export const GCM2_PER_OZIN2 = G_PER_OZ / 6.4516;

export type Shape =
  | { kind: 'round'; diameterIn: number; wallIn?: number }
  | { kind: 'rect'; lengthIn: number; widthIn: number; wallIn?: number };

export const gToOz = (g: number): number => g / G_PER_OZ;
export const ozToG = (oz: number): number => oz * G_PER_OZ;

/**
 * Dough-bearing area in square inches.
 *
 * `wallIn` is the height dough is pressed up the side of a pan. Published
 * figures disagree on whether to count it — Real Deep Dish states HFUTS = 0,
 * meaning base only — so it is an explicit input rather than a hidden
 * assumption.
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
export const thicknessFactor = (doughOz: number, shape: Shape): number =>
  doughOz / areaIn2(shape);

export const tfFromGrams = (doughG: number, shape: Shape): number =>
  thicknessFactor(gToOz(doughG), shape);

export const doughWeightOz = (tf: number, shape: Shape): number => tf * areaIn2(shape);

/** Round pizzas only: the diameter that puts `doughOz` at `tf`. */
export const diameterForTf = (tf: number, doughOz: number): number =>
  2 * Math.sqrt(doughOz / (tf * Math.PI));

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
 * for any formula-based dough — doubling the pastry-pizza 2-ball batch
 * reproduces its printed 4-ball batch to the gram.
 *
 * Volume strings are deliberately dropped: "1¾ cups + 2 Tbsp" has no meaningful
 * scaled form, and a plausible-looking wrong volume is worse than none.
 */
export function scaleIngredients(
  ings: readonly Ingredient[],
  targetTotalG: number,
): Ingredient[] {
  const current = totalG(ings);
  if (current <= 0) throw new Error('Cannot scale a batch with no weight.');
  const factor = targetTotalG / current;
  return ings.map(({ vol: _vol, ...rest }) => ({ ...rest, g: rest.g * factor }));
}

export function bakersPercents(
  ings: readonly Ingredient[],
): Array<{ item: string; pct: number }> {
  const flour = ings.find((i) => i.isFlour);
  if (!flour) {
    throw new Error('No ingredient marked isFlour; cannot compute bakers’ percentages.');
  }
  return ings.map((i) => ({ item: i.item, pct: (i.g / flour.g) * 100 }));
}

export interface RefTableOpts {
  ozFrom: number; ozTo: number; ozStep: number; diameters: readonly number[];
}
export interface RefTable {
  diameters: readonly number[];
  rows: Array<{ oz: number; g: number; tf: number[] }>;
}

/**
 * Generated rather than transcribed from the published worksheet image, which
 * contains at least one rounding error: 30 oz at 20″ prints as 0.096, but the
 * true value is 0.09549.
 */
export function referenceTable(
  { ozFrom, ozTo, ozStep, diameters }: RefTableOpts,
): RefTable {
  const rows: RefTable['rows'] = [];
  const steps = Math.round((ozTo - ozFrom) / ozStep);
  for (let i = 0; i <= steps; i++) {
    const oz = +(ozFrom + i * ozStep).toFixed(4);
    rows.push({
      oz,
      g: ozToG(oz),
      tf: diameters.map((d) => thicknessFactor(oz, { kind: 'round', diameterIn: d })),
    });
  }
  return { diameters, rows };
}
