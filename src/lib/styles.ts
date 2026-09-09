/**
 * Pizza style bands by thickness factor.
 *
 * Two tiers, kept strictly apart because they have different authority:
 *   sourced      — quoted from Pete-zza's list at SOURCE_URL
 *   extrapolated — inferred to extend coverage; flagged as such in the UI
 *
 * Tune these as you bake. Nothing else in the codebase hardcodes a TF number.
 */

export type BandTier = 'sourced' | 'extrapolated';

export interface StyleBand {
  id: string;
  name: string;
  min: number;
  max: number;
  tier: BandTier;
  note?: string;
}

export interface MeasuredPoint {
  id: string;
  name: string;
  tf: number;
  basis: string;
}

export const SOURCE_URL =
  'https://www.pizzamaking.com/forum/index.php/topic,39674.0.html';

export const SCALE_MIN = 0.04;
export const SCALE_MAX = 0.18;

export const BANDS: readonly StyleBand[] = [
  { id: 'cracker-crispy',    name: 'Cracker, thin & crispy', min: 0.05,  max: 0.08,  tier: 'sourced' },
  { id: 'neapolitan-hot',    name: 'Neapolitan, high-temp',  min: 0.07,  max: 0.08,  tier: 'sourced' },
  { id: 'ny-elite',          name: '“Elite” NY',             min: 0.065, max: 0.085, tier: 'sourced' },
  { id: 'ny-slice',          name: 'NY street / slice',      min: 0.085, max: 0.10,  tier: 'sourced' },
  { id: 'cracker-tender',    name: 'Cracker, thin & tender', min: 0.09,  max: 0.10,  tier: 'sourced' },
  { id: 'neapolitan-home',   name: 'Neapolitan, home oven',  min: 0.095, max: 0.11,  tier: 'sourced' },
  { id: 'chicago-deep-dish', name: 'Chicago deep-dish',      min: 0.11,  max: 0.135, tier: 'sourced' },
  { id: 'american',          name: 'American',               min: 0.12,  max: 0.14,  tier: 'sourced' },
  { id: 'sicilian',          name: 'Sicilian',               min: 0.12,  max: 0.15,  tier: 'sourced',
    note: 'Listed as 0.12–0.13, with 0.15 reported in the wild.' },
  { id: 'tavern',            name: 'Tavern / Chicago thin',  min: 0.055, max: 0.075, tier: 'extrapolated',
    note: 'Inferred: sits inside the sourced crispy-cracker band.' },
  { id: 'grandma',           name: 'Grandma',                min: 0.10,  max: 0.12,  tier: 'extrapolated',
    note: 'Inferred: between the thin and Sicilian bands.' },
  { id: 'detroit',           name: 'Detroit',                min: 0.12,  max: 0.15,  tier: 'extrapolated',
    note: 'Inferred: Sicilian-adjacent, pan-baked.' },
  { id: 'pan-hut',           name: 'Pizza Hut-style pan',    min: 0.13,  max: 0.16,  tier: 'extrapolated',
    note: 'Inferred: above Sicilian; matches this portal’s pan variation.' },
];

export const MEASURED: readonly MeasuredPoint[] = [
  { id: 'recipe-pastry-pizza',   name: 'Pastry pizza',          tf: 0.0779,
    basis: '210 g ball at 11″ round' },
  { id: 'recipe-deep-dish-wall', name: 'Deep dish, 1.5″ lip',   tf: 0.1105,
    basis: 'same dough, pan wall counted' },
  { id: 'recipe-deep-dish-base', name: 'Deep dish, base only',  tf: 0.1657,
    basis: 'publisher’s stated figure, HFUTS = 0' },
];

/** Every band containing this TF. Several may match; none is a valid answer. */
export const bandsFor = (tf: number): StyleBand[] =>
  BANDS.filter((b) => tf >= b.min && tf <= b.max);

export const bandById = (id: string): StyleBand | undefined =>
  BANDS.find((b) => b.id === id);

/** Midpoint of a band — the target TF when someone picks a style by name. */
export const bandMid = (b: StyleBand): number => (b.min + b.max) / 2;
