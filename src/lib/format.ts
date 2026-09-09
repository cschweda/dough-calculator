import { GCM2_PER_OZIN2 } from './dough';

const trimZeros = (s: string): string => s.replace(/\.0+$/, '');

/** Grams at a precision a kitchen scale can actually hit. */
export const fmtGrams = (g: number): string =>
  `${trimZeros(g >= 10 ? g.toFixed(0) : g.toFixed(1))} g`;

/**
 * Thickness factor is never shown as a bare number. The unit is what tells the
 * reader which convention is in play.
 */
export const fmtTf = (tf: number): string => `${tf.toFixed(3)} oz/in²`;

export const fmtTfMetric = (tf: number): string =>
  `${(tf * GCM2_PER_OZIN2).toFixed(3)} g/cm²`;

export const fmtIn = (n: number): string => `${parseFloat(n.toFixed(2))}″`;

export const fmtPct = (p: number): string => `${parseFloat(p.toFixed(2))}%`;
