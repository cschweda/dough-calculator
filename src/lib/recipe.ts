import type { Shape } from './dough';

/** The `target` shape as it comes out of the content collection schema. */
export interface RecipeTarget {
  shape: 'round' | 'rect';
  diameterIn?: number | undefined;
  lengthIn?: number | undefined;
  widthIn?: number | undefined;
  wallIn: number;
  assumed: boolean;
  note?: string | undefined;
}

/**
 * Convert a recipe target into a Shape.
 *
 * `includeWall` is explicit at every call site because the two conventions give
 * materially different answers — Real Deep Dish publishes 0.1657 base-only for a
 * dough that reads 0.110 with its own 1.5" lip counted.
 */
export function toShape(t: RecipeTarget, includeWall: boolean): Shape | null {
  const wallIn = includeWall ? t.wallIn : 0;
  if (t.shape === 'round') {
    return t.diameterIn == null ? null : { kind: 'round', diameterIn: t.diameterIn, wallIn };
  }
  return t.lengthIn == null || t.widthIn == null
    ? null
    : { kind: 'rect', lengthIn: t.lengthIn, widthIn: t.widthIn, wallIn };
}

export const describeTarget = (t: RecipeTarget): string =>
  t.shape === 'round'
    ? `${t.diameterIn}″ round`
    : `${t.lengthIn}″ × ${t.widthIn}″`;
