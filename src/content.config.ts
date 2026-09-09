import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

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
}).refine(
  (t) => (t.shape === 'round' ? t.diameterIn != null : t.lengthIn != null && t.widthIn != null),
  { message: 'A round target needs diameterIn; a rect target needs lengthIn and widthIn.' },
);

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
