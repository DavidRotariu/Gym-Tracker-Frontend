# Overload — polish pass

This is a **targeted polish pass on an existing, working app**, not a redesign.
The information architecture, routes, data layer and component structure are
settled and correct. Do not rebuild them. Change only what each section below
names.

## Current state (verify before starting, don't redo)

- Next.js 15 + React 19 + **Tailwind v4**. There is **no `tailwind.config.js`** —
  all design tokens live in `src/app/globals.css` under `@theme inline`, and
  dark mode is `@custom-variant dark (&:where(.dark, .dark *))`. Do not create a
  v3-style config.
- `npx tsc --noEmit` currently passes. Keep it passing after every section.
- The app runs fully offline against MSW mocks (`NEXT_PUBLIC_USE_MOCKS=true` in
  `.env.local`). Sign in as `demo@overload.app` / `demo1234`.
- API layer (`src/lib/api/*`), hooks (`src/hooks/*`), types (`src/types/index.ts`)
  and mock handlers (`src/lib/mock/*`) are **finished and correct**. This is a
  presentation-layer pass — do not change request/response shapes.
- `src/lib/utils.ts` wraps `tailwind-merge` with `extendTailwindMerge` so custom
  scales survive `cn()`. **Any new font-size, radius or font-family token must be
  registered there**, or it will be silently dropped at runtime.
- Imagery is already wired end to end: `public/muscles/` has 15 anatomical PNGs,
  `public/exercises/` has 153 demo assets (123 `.mp4`, 30 `.jpg`), all 15 mock
  muscles and all 21 mock exercises already carry an `image_url`, and
  `src/components/ui/MediaThumb.tsx` renders image-or-video with graceful
  fallback. **The assets are not missing — they are just barely used.** Only
  `ExercisePicker` renders them today.

## The problem to fix

The app is structurally sound but reads as flat and generic next to the
reference apps. The gap is four things, in order of impact:

1. Almost no imagery, despite 168 assets sitting in `public/`.
2. Numbers are set in the same face as body copy, so nothing feels like a
   headline moment.
3. Light-first, low-contrast surfaces where the references are near-black with
   clearly elevated cards.
4. Set logging costs too many taps mid-workout.

---

## 1. Accent: volt green → Nike orange

The volt green was a wrong turn. Replace it everywhere with a warm orange.

In `globals.css`:

- `--accent`: `#FF7A2F` (light) / `#FF8A45` (dark). Adjust to taste but stay in
  the NRC register.
- `--accent-foreground`: keep `#111111`. **Black ink on orange, never white** —
  black-on-orange is roughly 7:1, white-on-orange is roughly 2.9:1 and fails.
- Add `--accent-ink`: `#C2510A` (light) / `#FF9F5A` (dark), mapped to
  `--color-accent-ink`. Use this, never `--accent`, whenever the accent is
  **text or an icon on a plain background** (links, active states, small
  glyphs). `#FF7A2F` as text on white is about 2.9:1 and is not acceptable.
- Rename `--accent-muted` values to warm equivalents: `#FFF0E6` / `#3A1E0C`.

Then sweep the codebase for accent usage and split it by role:

- **Fills** (Start Workout CTA, play buttons, selected chips, PR cards, the
  superset rail, `Gauge` fill, `RirPicker` selection): `bg-accent` +
  `text-accent-foreground`. Unchanged in behaviour, just now orange.
- **Text/icon accents**: switch to `text-accent-ink`.

Reserve orange for: the primary CTA, the active segmented-control pill, progress
fills, and PR/celebration moments. Everything else stays black / white / gray.
Do not spray it.

## 2. Dark-first

Dark becomes the default and the primary design target; light stays fully
working but secondary.

- Flip the default in `src/components/ThemeProvider.tsx` (`themeInitScript`) so
  an unset preference resolves to dark rather than to the system value. Keep the
  existing manual-override plumbing and the `suppressHydrationWarning` setup.
- Update `viewport.themeColor` in `src/app/layout.tsx` accordingly.
- Retune the dark ramp for the "premium near-black" look — pure `#000` page with
  visibly lifted cards, rather than today's flat charcoal:
  - `--background: #000000`
  - `--background-secondary: #121214` (cards)
  - add `--background-elevated: #1C1C1E` (sheets, the rest-timer bar, anything
    floating), mapped to `--color-background-elevated`
  - `--separator: #2A2A2C`
  - `--fill: #1F1F22`, `--fill-strong: #2C2C2E`
- Re-check light mode on every screen after this; it must not regress.

## 3. A condensed display face for stat moments

SF Pro cannot reach the weight the reference numbers have. Add exactly one
display face, used **only** for hero numbers and uppercase kickers.

- Load **Archivo** (variable, supports weight and width axes) via
  `next/font/google` in `layout.tsx`, exposed as `--font-archivo`. Set weight
  800–900 and a narrowed width (~85) where the axis is available.
- Add a **third** family token `--font-stat` in `globals.css` mapped to
  `--font-stat` in `@theme`, and register `stat` in the `font-family` class
  group in `utils.ts`.
- Apply it to `--text-stat`, `--text-stat-sm` and `--text-kicker` **only**.
- **Leave `--text-large-title` on SF Pro Display.** The 34px iOS large title is
  a system convention and should stay native; the condensed face is a brand
  layer on top, not a replacement for the iOS shell.
- Keep `font-variant-numeric: tabular-nums` (the `.tabular` class) on every
  changing number so digits don't jitter.

## 4. Put the imagery to work (highest impact)

`MediaThumb` already exists and handles image/video/fallback. Two changes to it
first, then use it widely:

- Add a `static` prop. When set, render `<video>` with `autoPlay={false}`
  `preload="metadata"` so a still first frame shows without decoding 20 clips at
  once. **Lists and thumbnails must use `static`; only a hero or the currently
  active exercise may autoplay.** 123 autoplaying videos in a scroll view will
  tank the frame rate.
- Respect motion preferences: if `prefers-reduced-motion: reduce`, never
  autoplay — fall back to the still frame. Use a `useReducedMotion()` check.

Then add imagery here:

- **Home → "Up next" card**: make the split's primary muscle image a full-bleed
  card background with a bottom-up gradient scrim (`from-black/70`), split name
  and muscle chips sitting on top, play button top-right. This is the single
  biggest visual upgrade on the app's first-impression screen — model it on the
  teal "Upper / Muscle Building" card in reference 2.
- **`SplitCard`**: a stack of up to 3 small muscle-diagram thumbnails on the
  leading edge, or a single one if the split targets one muscle.
- **`ExerciseCard`** (active workout + history detail): 44×44 rounded `static`
  thumbnail to the left of the exercise name.
- **Exercise detail** (`/exercises/[id]`): full-width autoplaying demo loop as
  the hero, rounded `--radius-card`, with the favourite toggle overlaid.
- **`ExercisePicker`**: already good — keep as is.

Every media surface needs a real fallback (the initial-letter treatment already
in `MediaThumb`), because production data may have no `image_url` at all —
`image_url` is optional on the types and is currently a mock-only extension.

## 5. Set logging → table layout, native keyboard

Replace the expand-a-row-to-edit interaction in `src/components/workout/SetRow.tsx`
with a dense table, modelled on reference 6.

Columns: `Set │ Previous │ kg │ Reps │ ✓`

- **Set**: the set number in a small circular chip; tap it to cycle set type
  (keep `SetTypeBadge`'s colour semantics — warm-up orange, drop purple, failure
  red).
- **Previous**: last session's result for this exercise as flat gray text, e.g.
  `80 kg × 10`. Source it from the data already available via
  `GET /exercises/{id}/last-set` and `GET /exercises/{id}/history` — no new
  endpoints. Show `—` when there's no history. Tapping it copies those values
  into the row.
- **kg / Reps**: always-visible inputs, not steppers. Use
  `inputMode="decimal"` / `inputMode="numeric"` so iOS raises the numeric
  keyboard; do **not** build a custom keypad. Select-on-focus. Commit on blur
  and on Enter.
- **✓**: the completion toggle, 44×44 hit area, keeping the existing spring
  bounce and the green completed state.
- RIR moves to a compact control that only appears for the row being edited —
  don't let it widen the table.

Keep `Stepper.tsx` — `MuscleAllocator` still uses it. Just stop using it for
weight/reps.

Row height must stay comfortably tappable (≥44px) even though the layout is
denser.

## 6. Tab bar: NRC-style active pill

In `src/components/ui/TabBar.tsx`, replace the current orange-chip-behind-icon
treatment.

Match the real NRC bar in references 4 and 5: the active tab gets a **subtle
neutral rounded-rect pill** (`bg-fill`) behind the icon **and** label together,
with icon and label both at full `--color-label` contrast and semibold weight.
Inactive tabs stay `--color-label-secondary`.

Note this supersedes the earlier "active tab uses the accent colour" instruction
— in the actual reference the accent is *not* used in the tab bar. That keeps
orange meaningful for CTAs and progress, and removes the contrast workaround the
volt palette forced.

Keep: 10px labels, medium weight, translucent `bg-chrome` with
`backdrop-filter: blur(20px)`, `env(safe-area-inset-bottom)` padding, 56px min
row height.

## 7. Spacing and restraint

The references breathe more than the current build does.

- Section-to-section gap on scroll screens: 32px (`gap-8`). Card padding: 16–20px.
- Prefer one confident element over three competing ones. On Home specifically,
  do not stack a stat row, a suggested card, and a recent list all at equal
  weight — the "Up next" card should clearly dominate.
- Keep elevation flat: hairline `border-separator` dividers, no card shadows.
  Shadow is for sheets and the floating rest timer only.
- Stay on the 4px grid. No `gap-1.5`, no `p-2.5`.
- All interactive text stays medium or semibold — never regular weight.

## 8. Explicitly out of scope

- **No new charts, rings or data visualisation.** Restyle what exists.
- No centre FAB in the tab bar.
- No route, IA, or navigation changes.
- No changes to `src/lib/api/*`, `src/hooks/*`, `src/types/index.ts`, or
  `src/lib/mock/handlers.ts`.
- Do not touch the celebration screen's structure in `WorkoutSummary.tsx` —
  only restyle it to orange and the new display face. Its full-bleed accent
  takeover is correct and should stay theme-independent.

## 9. Definition of done

Work in the order above, keeping the app runnable after each section. For each:

1. `npx tsc --noEmit` passes.
2. The screen is checked in **both** dark and light mode.
3. No token is referenced that isn't registered in both `globals.css` and
   `utils.ts`.
4. Autoplaying video appears only on hero/active surfaces, never in lists.
5. Every interactive control still clears a 44×44 tap target.
