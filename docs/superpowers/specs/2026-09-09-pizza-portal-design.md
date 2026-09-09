# Pizza Portal — Design

**Date:** 2026-09-09
**Status:** Approved for planning

## 1. Purpose

A static portal for bread and pizza recipes. The home page is a grid of cards;
each card opens a full recipe page that prints cleanly. A dough thickness
calculator, built from the pizzamaking.com thickness-factor method, is available
both as a standalone tool and as a scaling mode inside each recipe.

Dark by default, with a light/dark toggle. Fully responsive. Accessibility is a
build requirement, not a review step.

Two recipes at launch:

1. **Pastry-Style Pizza Dough** — the author's own, thin and crisp, TF 0.0779,
   with 2-ball, 4-ball, and deep-dish-pan variations.
2. **Real Deep Dish "Holy Grail"** — authentic Chicago deep dish from
   realdeepdish.com, TF 0.1657, in 9, 10, 12, and 14 inch sizes.

They bracket the thickness range nicely, which is a good stress test of the
calculator. More pizza, focaccia, and bread recipes will follow, so every
decision below is made for recipe #20, not #2.

## 2. Source material and provenance

Three sources, with different levels of authority. The distinction is carried
through into the UI.

| Source | Used for | Authority |
| --- | --- | --- |
| `.vscode/docs/pastry-pizza-dough-recipe.html` | Recipe #1 content, verbatim | Author's own |
| pizzamaking.com forum topic 39674 | TF formula, style bands | Cited, quoted |
| "Thickness Factor Spreadsheet V3.jpg" | Cross-check only | Superseded by computation |
| `RDDHolyGrail.pdf` / realdeepdish.com | Recipe #2 content | Third party, attributed |

### 2.1 The formula

From Pete-zza, reply #12 of that thread, and confirmed by the worksheet footnote:

```
round:  TF = doughBallWeightOz / (pi * r^2)         r in inches
rect:   TF = doughBallWeightOz / (L * W)            L, W in inches
grams -> ounces: divide by 28.35
```

TF is expressed in **oz/in^2**. It is always displayed with that unit.

### 2.2 Verified before design

Recomputing the worksheet's published cells matched 7 of 8 spot-checks exactly.
The eighth (30 oz at 20 inches) is a rounding artifact in the spreadsheet: the
true value is 0.09549, the image prints 0.096. **The reference table is therefore
generated at build time from the formula, not transcribed from the image.** This
is more accurate and is not limited to the image's 8-35 oz / 10-24 inch range.

Recipe #1 sits at **0.0779 oz/in^2** (210 g ball, 11 inch round), which falls in
the sourced "Neapolitan high-temp" (0.07-0.08) and "thin crispy cracker"
(0.05-0.08) bands, consistent with the recipe's own description of the crust as
thin, crisp, and buttery.

Scaling the 2-ball batch proportionally to 836 g reproduces the printed 4-ball
batch exactly, to the gram, across all nine ingredients. **Dough scaling is exact
arithmetic for this recipe, not an approximation.**

The unit conversion is 1 oz/in^2 = 4.3943 g/cm^2.

Recipe #2 independently validates the engine. Real Deep Dish publishes its own
thickness factor (`NEWdough-calc-TF = 0.1657`); computing from that recipe's own
ingredient list yields **0.1657**. Its four sizes land at 0.1657, 0.1660, 0.1659,
and 0.1662 — one dough, cleanly scaled — and its stated bakers' percentages match
the listed gram weights to two decimals.

That cross-check also surfaced an error in the source PDF: the 14 inch batch is
headed "total weight 732 grams", but its own ingredient list sums to 724.4 g.
Every other size is internally consistent within 1 g. **The site uses the
ingredient sum, and the recipe carries an editorial note recording the
discrepancy.** Silently propagating the wrong figure, or silently correcting it,
are both worse than saying so.

### 2.3 The unit trap

That forum thread contains a user arriving at wrong answers by substituting
centimetres into a formula defined in inches. This is a known, documented failure
mode of the method, so the calculator must make mixed units structurally
impossible: inputs carry an explicit unit, all computation happens internally in
ounces and inches, and TF is never rendered as a bare number.

### 2.4 Pan walls change the answer

Recipe #2 declares `HFUTS = 0` — its TF counts the pan's base area only and
ignores the dough pressed up the sides. This matters, because that recipe
instructs the baker to pinch a lip 1 to 1.5 inches high.

Counting the wall as additional dough-bearing area, `area = pi*r^2 + pi*d*h`, the
same dough reads:

| Lip height | TF |
| --- | --- |
| 0 (base only, as published) | 0.1657 |
| 1.0 in | 0.1243 |
| 1.25 in | 0.1170 |
| 1.5 in | 0.1105 |

This resolves an apparent contradiction between the two sources. The forum's
sourced Chicago deep-dish band is 0.11-0.135, and a real published deep-dish
recipe sits at 0.1657 — seemingly far outside it. But at every lip height the
recipe actually calls for, the same dough falls **inside** that band. The sources
agree; they measure area differently.

Therefore wall height is a first-class input, not a refinement. For pan styles the
calculator shows both readings, labelled, rather than picking one and hiding the
assumption.

## 3. Architecture

Astro, static output, zero client framework. Interactivity is small islands of
vanilla TypeScript, always as progressive enhancement over working HTML.

```
src/
  content.config.ts          collection schema (Zod)
  content/recipes/*.md       one file per recipe
  lib/
    dough.ts                 pure calculation engine — no DOM, no framework
    dough.test.ts            unit tests
    format.ts                number/unit rendering
    styles.ts                style band data (sourced vs extrapolated)
  components/
    RecipeCard.astro         ToolCard.astro       ThemeToggle.astro
    BatchTable.astro         SegmentedControl.astro
    DoughCalculator.astro    StyleScale.astro     IngredientRow.astro
  layouts/BaseLayout.astro
  pages/
    index.astro                       card grid
    recipes/[...slug].astro           recipe detail
    tools/dough-calculator.astro      standalone tool
  styles/
    tokens.css  base.css  print.css
```

### 3.1 Why one engine, two surfaces

The recipe is a clean proportional formula (section 2.2), so a target dough
weight from the calculator scales every ingredient exactly. The calculator is
therefore not a bolted-on page; it is the mechanism that makes recipes adaptive.
Both surfaces import the same `dough.ts`.

```
dough.ts ──┬──▶ /tools/dough-calculator   solver + generated reference table
           └──▶ recipe pages              "Scale to my pan" batch mode
```

### 3.2 Content schema

```ts
const ingredient = z.object({
  item:     z.string(),
  g:        z.number().nonnegative(),   // grams, canonical
  vol:      z.string().optional(),      // "1 3/4 cups + 2 Tbsp" — display only
  optional: z.boolean().default(false),
  note:     z.string().optional(),
  isFlour:  z.boolean().default(false), // only for bakers'-% display
});

const batch = z.object({
  id:          z.string(),              // "2-ball" | "4-ball" | "pan"
  name:        z.string(),
  yield:       z.string().optional(),
  balls:       z.number().int().positive().default(1),
  ballWeightG: z.number().positive().optional(),
  target:      shape.optional(),        // what this batch is sized for
  ingredients: z.array(ingredient).min(1),
});

const recipe = z.object({
  title:    z.string(),
  blurb:    z.string(),
  category: z.enum(["pizza", "focaccia", "bread"]),
  tags:     z.array(z.string()).default([]),
  times:    z.object({ ferment: z.string().optional(),
                       rest:    z.string().optional(),
                       bake:    z.string().optional() }).optional(),
  scalable: z.boolean().default(false), // enables "Scale to my pan"
  batches:  z.array(batch).min(1),
  source:   z.string().optional(),
  order:    z.number().default(0),
});
```

Prose — method, baking, notes — is the Markdown body. Ingredient data is
frontmatter. A malformed recipe fails the build.

### 3.3 Engine API

```ts
export type Shape =
  | { kind: "round"; diameterIn: number; wallIn?: number }
  | { kind: "rect";  lengthIn: number; widthIn: number; wallIn?: number };

areaIn2(shape): number          // base; adds wall area when wallIn > 0
thicknessFactor(doughOz, shape): number
doughWeightOz(tf, shape): number
diameterForTf(tf, doughOz): number
bandsFor(tf): StyleBand[]                       // may match several
scaleIngredients(ings, targetTotalG): Ingredient[]   // proportional, exact
bakersPercents(ings): Record<string, number>         // display only
referenceTable(opts): Cell[][]                       // generated, not transcribed
```

Scaling is proportional across the whole ingredient list; it does not need to
identify the flour. `isFlour` exists only so the page can show bakers'
percentages, which recipe #1 states in its own notes.

## 4. Style bands

Two tiers, visibly distinguished in the UI. Sourced bands carry a citation link
to the thread; extrapolated bands are marked as inferred. All of it lives in
`src/lib/styles.ts` so values can be tuned without touching components.

**Sourced** — Pete-zza's list, quoted in reply #3 of the thread:

| Style | TF |
| --- | --- |
| Thin "crispy" cracker | 0.05-0.08 |
| Neapolitan, high-temp | 0.07-0.08 |
| "Elite" NY | 0.065-0.085 |
| NY street/slice | 0.085-0.10 |
| Thin "tender" cracker | 0.09-0.10 |
| Thin (general) | 0.10 |
| Neapolitan, home oven | 0.095-0.11 |
| Medium (general) | 0.11 |
| Chicago deep-dish | 0.11-0.135 |
| Thick (general) | 0.12-0.13 |
| Sicilian | 0.12-0.13 (seen to 0.15) |
| American | 0.12-0.14 |

**Extrapolated** — requested to extend coverage; not in the source list:

| Style | TF | Basis |
| --- | --- | --- |
| Tavern / Chicago thin | ~0.055-0.075 | within sourced crispy-cracker band |
| Grandma | ~0.10-0.12 | between thin and Sicilian |
| Detroit | ~0.12-0.15 | Sicilian-adjacent, pan-baked |
| Pizza Hut-style pan | ~0.13-0.16 | above Sicilian; matches recipe #1's pan variation |

**Measured references** — computed from actual recipes in this portal, shown as
points on the scale rather than bands, so a reading can be compared against
something real:

| Reference | TF | Basis |
| --- | --- | --- |
| Recipe #1, pastry pizza | 0.0779 | 210 g at 11 in round |
| Recipe #2, deep dish, base only | 0.1657 | publisher's own stated figure |
| Recipe #2, deep dish, 1.5 in lip | 0.1105 | wall area counted, section 2.4 |

The band scale must therefore span at least 0.05 to 0.17 to contain real deep
dish, which the sourced list alone does not reach.

The thread also records a practical caveat worth surfacing as a note: commercial
pizzerias run heavier than these figures because of box fit, oven shrinkage, and
topping load.

## 5. Pages

### 5.1 Home

Responsive card grid. Recipe cards show title, blurb, category, key times, and
the recipe's thickness factor. A visually distinct tool card links to the
calculator. Cards are a single link each — the whole card is one focusable
target, not a card containing several.

Three cards at launch: two recipes and the calculator.

Category is rendered as a badge now; filtering is deliberately deferred
(section 9).

### 5.2 Recipe page

Header, then the ingredient area, then Markdown prose, then source attribution.

The ingredient area has two controls, built as native radio groups so keyboard
and screen-reader behaviour come for free:

```
  recipe #1   Batch: ( ) 2 balls ( ) 4 balls ( ) Pan  ( ) Scale to my pan
  recipe #2   Batch: ( ) 9 in ( ) 10 in ( ) 12 in ( ) 14 in  ( ) Scale to my pan
              Units: ( ) grams  ( ) volume
```

Batch options come from the recipe's own `batches` array, so the control must
handle two options or six. It wraps rather than scrolls on narrow screens.

Every fixed batch displays its own computed thickness factor next to its name,
which is how the measured references in section 4 reach the page. For batches
baked in a walled pan, both readings are shown, per section 2.4.

Selecting **Scale to my pan** reveals shape, size, wall height, style, and
ball-count inputs, shows the resulting per-ball weight and TF with its matching
style bands, and rewrites every ingredient quantity proportionally.

In scale mode the **volume column is hidden**, because strings like
"1 3/4 cups + 2 Tbsp" cannot be scaled meaningfully. The UI states this rather
than silently dropping the column.

Fixed presets remain the default and remain first, because they are the tested
batches and the recipe prose refers to them by name.

### 5.3 Dough calculator

A "solve for" segmented control matching the recipe page's interaction language:

- **Dough weight** — shape + size + style, gives weight per ball and total
- **Pizza size** — weight + style, gives diameter or pan dimensions
- **Thickness factor** — weight + size, gives TF and its style bands

Shape offers round and rectangular, each with an optional **wall height** for
pan bakes. When wall height is greater than zero the result shows both the
base-only and wall-included readings side by side, labelled, because published
figures differ on which convention they use (section 2.4).

Below the solver: the generated reference table, with the current result
highlighted, and a link back to the source thread.

Both unit systems are shown together (oz/in^2 alongside g/cm^2) so the trap in
section 2.3 cannot bite.

## 6. Theme

Dark is the default on first visit, per the brief — `prefers-color-scheme` is not
consulted for the initial value. The toggle persists to `localStorage`. A small
inline script in `<head>` sets `data-theme` before first paint so there is no
flash. All colors are CSS custom properties defined on `:root` and overridden
under `[data-theme="light"]`.

## 7. Print

Printing is handled by a stylesheet on the recipe page itself. No second route,
no second template, so the printout cannot drift from the page. A Print button
calls `window.print()`; Cmd-P produces the same result.

- `@page { size: letter; margin: 0.6in }`
- Every batch expands; both grams and volume columns show
- Nav, toggles, theme control, and calculator inputs are hidden
- Colors forced to dark-on-white
- `break-inside: avoid` on method, baking, and each batch table
- Source attribution and page URL printed

## 8. Accessibility

Target: WCAG 2.1 AA throughout, verified rather than asserted.

- Semantic landmarks; one `h1` per page; no heading level skipped
- Skip-to-content link
- Native form controls; every input labelled; segmented controls are real radio
  groups with arrow-key navigation
- Calculator results announced via `aria-live="polite"`
- Tables use `<caption>` and `<th scope>`
- Style bands never encoded by color alone — always labelled text
- Visible focus on every interactive element
- `prefers-reduced-motion` respected
- Fully usable at 200% zoom and 320px width
- **No-JS**: recipe pages render all batches with both unit columns; the
  calculator page renders the formula, the style tables, and the reference table
  as static content

Verification gates, all of which must pass before the work is called done:

| Tool | Gate |
| --- | --- |
| lightcap `run_a11y` | 100 accessibility, every page |
| lightcap `run_audit` | performance / best practices / SEO recorded |
| axecap `audit_url` | zero violations |
| contrastcap `check_page_contrast` | zero failures, both themes |
| viewcap `take_screenshot` | 320 / 768 / 1440, both themes, plus print |

## 9. Non-goals

Deliberately excluded until there is evidence they are needed:

- Search and category filtering — revisit at roughly 8 recipes (2 at launch)
- Photography — typography and layout carry the design for now
- Accounts, favourites, comments, ratings
- A CMS; Markdown files in git are the CMS
- Unit conversion of volume strings
- Hydration/temperature calculators beyond thickness factor

## 10. Open items

- **Breville Pizzaiolo pan diameter is unconfirmed** and materially changes the
  pan pizza's TF: 417 g reads 0.130 at 12 inches (deep-dish/Sicilian) but 0.155
  at 11 inches (Pizza Hut pan). Modelled as a user input with a preset to be
  confirmed, not guessed.
- Extrapolated band values in section 4 are starting points to tune with baking.
- **Recipe #2 is third-party content** from realdeepdish.com. It is reproduced with
  prominent attribution, a link to the source, and the author's donation link, and
  its method is written in condensed form rather than copied verbatim. Ingredient
  quantities and procedure are facts; the original prose is not reproduced.
- Recipe #2's 14 inch stated total (732 g) contradicts its ingredient list
  (724.4 g); the site uses the ingredient sum and notes this.

## 11. Implementation notes

- `dough.ts` is written test-first. The worksheet's published cells make good
  regression fixtures, as does the 4-ball scaling identity from section 2.2.
- The `frontend-design` skill applies when establishing visual direction.
- The `dataviz` skill applies to the style-band scale, which is a meter.
