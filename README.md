# Dough Portal

Pizza and bread recipes with the dough maths worked out, plus a calculator that
scales any of them to the pan you actually own.

Live at **[doughmath.netlify.app](https://doughmath.netlify.app)**.

Built with [Astro](https://astro.build) as a static site. No UI framework, no
client-side router — the interactive bits are small vanilla-JS islands over
server-rendered HTML.

## The idea

Everything here is organised around **thickness factor** (TF), the ratio that
ties together the three things you actually care about:

```
TF = dough weight (oz) / dough-bearing area (in²)
```

Fix any two and the third follows. A 210 g ball on an 11″ round is TF 0.0779 —
thin and crisp. The same dough pressed into a 9″ deep-dish pan with a 1.5″ lip
is TF 0.1105, which is a different pizza entirely.

That means you can take a recipe written for one pan and get the correct dough
weight for a different one, instead of guessing and ending up with a thick,
under-baked base.

## Getting started

```bash
npm install
npm run dev          # http://localhost:4321
```

| Script | Does |
| --- | --- |
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Static build to `dist/` |
| `npm run preview` | Serve the built site |
| `npm run check` | `astro check` — types and content schema |
| `npm test` | Vitest, single run |
| `npm run test:watch` | Vitest in watch mode |

Astro 7 daemonises the dev server, so `npm run dev` returns immediately.
Use `npx astro dev status`, `logs`, and `stop` to manage it.

## Structure

```
src/
  content/recipes/    Recipes as markdown + typed frontmatter
  content.config.ts   Zod schema for the recipe collection
  lib/
    dough.ts          TF maths, scaling, bakers' percentages
    styles.ts         Pizza-style bands by TF
    recipe.ts         Recipe → view-model helpers
    format.ts         Number and unit formatting
  components/         Astro components (no framework)
  pages/
    index.astro                    Recipe index
    recipes/[...slug].astro        Recipe pages
    tools/dough-calculator.astro   Standalone calculator
  styles/             Design tokens, base, components, print
```

The maths in `src/lib/` is pure and framework-free — `dough.ts`, `styles.ts`,
and `format.ts` each have a matching `.test.ts` and are the only place TF
numbers live. Nothing else hardcodes a thickness factor.

## Adding a recipe

Drop a markdown file in `src/content/recipes/`. The frontmatter is validated by
the Zod schema in `src/content.config.ts`, so a malformed recipe fails the build
rather than rendering wrong.

```yaml
---
title: Pastry-Style Pizza Dough
blurb: Thin, crisp, and buttery. Cold-fermented 48–72 hours.
category: pizza            # pizza | focaccia | bread
tags: ["cold ferment", "thin crust"]
order: 1
scalable: true             # enables the scale-to-pan panel
times:
  ferment: 48–72 h cold
  rest: 2 h at room temperature
  bake: 1:30–2:00 at 700°F
batches:
  - id: two-ball
    name: 2 dough balls
    yield: about 210 g each
    balls: 2
    target: { shape: round, diameterIn: 11 }
    ingredients:
      - { item: "All-purpose flour", g: 228, vol: "1¾ cups + 2 Tbsp", isFlour: true }
      - { item: "Cool water", g: 118, vol: "½ cup" }
      - { item: "Olive oil", g: 42, vol: "3 Tbsp", note: "or other oil" }
---
```

Notes on the schema:

- **`g` is canonical.** Volumes (`vol`) are display-only and are deliberately
  dropped when a batch is scaled — a plausible-looking wrong volume is worse
  than no volume.
- **`isFlour`** marks the 100% reference for bakers' percentages.
- **`target.wallIn`** is the height dough is pressed up the pan side. It
  defaults to `0` because published figures disagree on whether to count it, so
  it is an explicit input rather than a hidden assumption.
- **`target.assumed: true`** flags a pan size that was inferred rather than
  stated by the source.

## Changelog

[`CHANGELOG.md`](CHANGELOG.md) lists every tag and every commit, newest first.
It is **generated from git history** — never edit it by hand.

```bash
npm run changelog         # regenerate
npm run changelog:check   # exit 1 if out of date
```

A `pre-commit` hook keeps it current automatically:

```bash
npm run hooks:install     # enable  (sets core.hooksPath to .githooks)
npm run hooks:uninstall   # disable
```

One caveat worth knowing: the hook runs *before* the commit object exists, so
the entry for the commit being made lands in the next commit. The committed
changelog therefore trails `HEAD` by one entry. That is unavoidable — a file
cannot contain its own commit hash — so run `npm run changelog` right before
tagging, and the release commit will carry a complete list.

## Deploying

Netlify builds this from `netlify.toml`: `npm run build`, publish `dist/`. No
adapter or serverless runtime is involved — the output is plain static files.

The Node version is pinned in **both** `.nvmrc` and `netlify.toml`, kept
identical. Astro 7 requires Node >= 22.12.0 and Netlify picks its own default
for a repo that does not say otherwise, so leaving this unpinned risks a build
failure whose error message does not mention the Node version.

`netlify.toml` also sets long-lived immutable caching for `/_astro/*` (those
filenames are content-hashed, so it is safe) and a set of security headers.

`astro.config.mjs` sets `site` to the live URL, so `@astrojs/sitemap` and
canonical tags will produce correct absolute URLs if you add them.

### TypeScript is capped at 6.x

`@astrojs/check` (which powers `npm run check`) declares a peer dependency of
`typescript@^5.0.0 || ^6.0.0`, and 0.9.10 is its newest release. **Bumping
TypeScript to 7 breaks the build** — `npm install` fails with `ERESOLVE` on a
clean checkout, even though an existing `node_modules` keeps working locally
and hides the problem. Revisit when `@astrojs/check` ships TypeScript 7
support.

## Data provenance

The TF method and the style bands come from
[Pete-zza's thread on pizzamaking.com](https://www.pizzamaking.com/forum/index.php/topic,39674.0.html).

Style bands are split into two tiers and the UI shows which is which:

- **sourced** — quoted from that thread.
- **extrapolated** — inferred here to extend coverage (Detroit, Grandma, tavern,
  Pizza Hut-style pan). Reasonable, but not from the source.

The reference table is *generated* from the formula rather than transcribed from
the published worksheet image, which contains at least one rounding error — 30 oz
at 20″ prints as 0.096, where the true value is 0.09549.

Recipes carry their own credit, source, and donation links in frontmatter, and
those render on the recipe page. The deep-dish recipe is reproduced from
[Real Deep Dish](https://www.realdeepdish.com/) for personal use — if you bake
it, consider throwing them a few dollars via the link on that page.
