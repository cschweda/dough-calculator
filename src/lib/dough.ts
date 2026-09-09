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
