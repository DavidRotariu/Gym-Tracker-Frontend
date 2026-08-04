# Prompt: Rebuild "Overload" — full frontend redesign

Paste this whole document as the instruction to a fresh Claude Code (or
equivalent) session, in the root of the `Gym-Tracker-Frontend` repo. It is
self-contained: read `docs/API_ARCHITECTURE.md` in the repo first, then
execute everything below.

---

## 1. Mission

Rebuild this gym-tracking frontend from scratch. The current app works but
looks generic (default shadcn styling, no visual identity) and its
architecture is thin (no shared API client, no shared types, prop-drilled
state, hardcoded URLs in two places). You are doing two things at once:

1. **A complete visual redesign** — professional, cool, minimalist, dark,
   premium, mobile-first. Not a template. It should not look like "an AI
   built a shadcn app."
2. **A complete architecture rebuild** — implement the data model and REST
   contract defined in `docs/API_ARCHITECTURE.md` on the frontend, with a
   proper typed API layer, no prop drilling, and no dead code.

The backend does not implement the new API yet. You will build a **mock
data layer** matching the contract exactly (see §6), so the app is fully
usable and demoable today. When the real backend catches up, swapping the
mock layer for real `fetch` calls should require touching only the API
client module, nothing else.

Ask the user before finalizing anything not covered by this document —
this brief deliberately leaves some execution details to your judgment,
but any genuinely ambiguous product decision (e.g. a feature's behavior
that the spec doesn't define) should be confirmed, not guessed.

---

## 2. Product identity

- **Name:** Overload — from "progressive overload," the core principle of
  strength training (lift more than last time, over time). It's also a
  literal visual anchor: the accent color and signature motif (§3) read as
  a circuit or gauge nearing its limit, tying the brand name to the UI.
- **Tone:** direct, competent, quiet confidence. No hype copy, no
  exclamation marks, no motivational-poster language. Talk to the user
  like a serious training tool, not a lifestyle app.
- **One-line pitch (for empty states, meta tags, etc.):** "Log every set.
  Track every overload."

---

## 3. Design system

Follow this token system exactly. Do not substitute a default
dark-mode-plus-accent look — every choice below is deliberate for this
brief; don't drift toward shadcn/Tailwind defaults.

### Color

| Token | Hex | Use |
|---|---|---|
| `bg` | `#0A0A0C` | app background |
| `surface` | `#151517` | cards, sheets |
| `surface-raised` | `#1C1C1F` | elevated cards, modals, active set row |
| `border` | `#27272B` | hairline dividers, card borders |
| `text-primary` | `#F2F2F0` | headings, primary numbers |
| `text-secondary` | `#8B8B90` | labels, captions, secondary numbers |
| `accent` | `#FF5A1F` | the one accent — primary CTA, active/selected state, PR highlight, the overload gauge (§3.4) |
| `accent-dim` | `#7A2E12` | accent at low intensity (e.g. gauge track, disabled-but-visible states) |
| `danger` | `#E5484D` | destructive actions only (delete set/workout) — used sparingly, never for anything else |

No secondary accent color. Every non-neutral color decision routes
through `accent` or `danger`. This restraint is the point — resist adding
a "success green" or "info blue," they dilute the one signal that matters
(effort/overload).

### Type

- **Display / numbers:** `Space Grotesk` (weights, rep counts, big stats,
  screen titles). Technical, slightly unusual, not a generic system font.
- **Body / UI text:** `Inter` (labels, buttons, descriptions, nav).
  Neutral and highly legible at small mobile sizes.
- **Data / mono:** `IBM Plex Mono` for anything tabular or timer-like:
  set numbers, rest-timer countdown, weight×reps in history rows. This is
  what makes the logging screens feel like an instrument panel instead of
  a form.

Load all three via `next/font`. Define a type scale in Tailwind config
(`text-display-xl` down to `text-caption`) rather than ad hoc sizes.

### Layout

- Single-column, mobile-first. Max content width on larger viewports:
  `480px` centered (this is a tool you use one-handed at the squat rack,
  not a dashboard to widen for desktop — desktop just gets the same
  column, centered, with breathing room around it).
- Bottom tab bar (fixed, safe-area aware) for primary nav: **Home**,
  **Splits**, **History**, **Profile**. Sits in the thumb-easy zone.
- Primary action per screen (e.g. "Start Workout," "Log Set") is
  bottom-anchored, full-width, in the easy thumb zone — never top-right.
- Generous vertical spacing between sections despite the dark theme —
  minimalist means precise spacing and restraint, not cramped density.

### Signature element: the Overload Gauge

The one memorable visual device, used everywhere a set's effort is shown:
a thin horizontal arc/bar next to each set that fills from `accent-dim`
toward `accent` as **RIR approaches 0** (i.e. closer to failure = closer
to "overload," full glow). At RIR 0 (failure set) it fills completely and
gets a subtle glow (`box-shadow` bloom in `accent`, respecting
`prefers-reduced-motion` — static full-fill instead of an animated pulse
when reduced motion is on). This single component appears on: the active
logging row, workout history rows, and the exercise-history/PR view. It's
functional (encodes real RIR data), not decorative — that's what makes it
a signature rather than a gimmick.

### Motion

- Page transitions: none/instant (this is a utility app opened mid-workout
  under load — don't make the user wait on a slide transition between
  sets).
- Micro-interactions: set-complete checkmark (subtle scale+fade, ~150ms),
  Overload Gauge fill transition (~200ms ease-out), rest-timer countdown
  (no animation needed beyond the number ticking).
- Respect `prefers-reduced-motion` everywhere — this is a hard requirement,
  not a nice-to-have (see §4).
- No decorative animation (no floating gradients, no parallax). If it
  doesn't communicate state, cut it.

---

## 4. Mobile-first rules (non-negotiable)

This app is used one-handed, mid-workout, often with sweaty hands and low
attention. Build accordingly:

- **Touch targets:** minimum 44×44px, 8px spacing between adjacent
  targets. This applies to every button, checkbox, and stepper — including
  the weight/reps +/− steppers on the logging screen, which are the most
  frequently tapped controls in the app.
- **Thumb zones:** primary actions (Start Workout, Log Set, Complete
  Workout) in the bottom third of the screen. Secondary/destructive
  actions (delete, settings) live near the top, where an accidental tap
  costs less.
- **No hover-only affordances.** Anything a hover reveals on desktop must
  be visible or reachable by tap on mobile by default. Gate hover
  enhancements behind `@media (hover: hover) and (pointer: fine)`.
- **Safe areas:** `viewport-fit=cover` in the viewport meta tag; bottom
  tab bar and any fixed bottom CTA use
  `padding-bottom: calc(env(safe-area-inset-bottom) + Npx)`.
- **Gestures:** swipe-to-delete on history rows and set rows (leading or
  trailing swipe reveals a delete action, matching the `danger` color);
  pull-to-refresh on the History list. Don't invent custom gestures for
  anything that already has a platform convention.
- **Reduced motion:** every animation in §3's motion section must check
  `prefers-reduced-motion` and fall back to an instant state change.
- **Performance:** this is a Next.js web app opened at the gym, possibly
  on spotty wifi/cellular — keep the JS bundle lean, avoid heavy animation
  libraries for what CSS transitions can do, lazy-load anything not on
  the critical path (e.g. QR upload UI).

---

## 5. Tech stack & architecture

- **Framework:** Next.js (App Router), TypeScript, unchanged.
- **Styling:** Tailwind CSS, with a custom theme (§3's tokens as Tailwind
  `colors`/`fontFamily`/`fontSize` extensions in `tailwind.config`) —
  **no shadcn/ui**. Delete `src/components/ui` entirely. Build a small,
  purpose-built component library instead (see file plan below) — every
  primitive you need (Button, Card, Sheet, TextField, Stepper, Gauge,
  TabBar) styled to this design system from the start, not generic
  primitives you theme after the fact.
- **Data fetching / state:** add **TanStack Query** (`@tanstack/react-query`)
  for all server state — this replaces the current pattern of manual
  `useState`/`useEffect`/prop-drilling in every component. One
  `QueryClientProvider` in the root layout. Each resource gets typed
  query/mutation hooks (see file plan). No React Context needed beyond
  auth (see below) — Query's cache is the shared state layer.
- **Auth state:** small dedicated auth module — a minimal context or a
  `useAuth()` hook backed by `localStorage`, extracted and cleaned up from
  the current inline logic in `login-form.tsx`/`signup-form.tsx`/
  `home/page.tsx`. Centralize token read/write and the redirect-if-missing
  check that's currently copy-pasted per page into one place (e.g. a
  layout-level guard or a `useRequireAuth()` hook).
- **API client:** one module, `src/lib/api/client.ts`, that owns the base
  URL, auth header injection, and JSON error handling. Every endpoint in
  `docs/API_ARCHITECTURE.md` gets a typed function
  (`src/lib/api/{resource}.ts`, e.g. `splits.ts`, `workouts.ts`,
  `exercises.ts`), built on this client. This is the fix for today's bug
  where two components hardcode the production URL directly — after this
  rebuild, the base URL is read from `NEXT_PUBLIC_BASE_URL` in exactly one
  place.
- **Types:** a `src/types/` module mirroring the entities in
  `docs/API_ARCHITECTURE.md` (`Split`, `WorkoutSession`, `WorkoutExercise`,
  `Set`, `Exercise`, `Muscle`, `Favorite`, `User`). Every API function and
  component imports from here — no more inline-redefined interfaces per
  file.

### File plan

```
src/
  app/
    (auth)/
      login/page.tsx
      signup/page.tsx
    (app)/                       # authenticated shell, tab-bar layout
      home/page.tsx
      splits/page.tsx
      splits/new/page.tsx
      splits/[id]/edit/page.tsx
      workout/[sessionId]/page.tsx   # active logging screen
      history/page.tsx
      history/[sessionId]/page.tsx
      exercises/[id]/page.tsx        # per-exercise history/PRs
      profile/page.tsx
    layout.tsx                   # fonts, QueryClientProvider, metadata
  components/
    ui/                          # Button, Card, Sheet, TextField, Stepper,
                                  # Gauge (the Overload Gauge), TabBar, etc.
    workout/                     # SetRow, ExercisePicker, SupersetGroup, RestTimer
    splits/                      # SplitCard, MuscleAllocator
  lib/
    api/
      client.ts
      auth.ts
      splits.ts
      exercises.ts
      workouts.ts
      favorites.ts
      users.ts
    mock/                        # see §6
    utils.ts                     # keep/refactor cn() from current file
  hooks/
    use-auth.ts
    use-splits.ts
    use-workout-session.ts
    ...one hook module per resource, wrapping the api/ functions in
    TanStack Query
  types/
    index.ts                     # or split per-entity if it grows
```

Delete everything under the current `src/app` and `src/components` except:
`src/lib/utils.ts` (keep, lightly cleaned up) and the auth **logic**
inside `login-form.tsx`/`signup-form.tsx` (rewrite as
`src/lib/api/auth.ts` + a `useAuth` hook + new UI components — don't keep
the files as-is, keep the working parts of the logic). Also delete the
three unused Next.js API proxy routes under the old `src/app/api/` — they
were dead code even before this rebuild.

---

## 6. Mock data layer

Since the real backend doesn't implement `docs/API_ARCHITECTURE.md` yet,
build a mock layer so the app is fully functional and demoable now, and
becomes a real backend integration later with a one-line swap.

- Use **MSW** (`msw`, browser mode via a service worker) to intercept
  `fetch` calls at the network level, matching the exact routes/methods/
  payload shapes documented in `docs/API_ARCHITECTURE.md`.
- Seed realistic fake data in `src/lib/mock/data.ts`: a handful of
  muscles, a realistic exercise catalog per muscle, 2–3 sample splits, and
  a few weeks of fake workout session history with varied set types, RIR
  values, and at least one superset — enough to make every screen (including
  empty vs. populated states) demoable.
- Persist mutations to `localStorage` during the session (so logging a
  set, completing a workout, or creating a split survives a page reload)
  but reset to the seed data on a "Reset demo data" action in Profile —
  don't make demo state a dead end.
- Gate this behind an env flag, e.g. `NEXT_PUBLIC_USE_MOCKS=true` in
  `.env.local`, checked once in `src/lib/api/client.ts` (or wherever MSW
  is initialized) — so turning it off later to point at the real backend
  is a one-line change, not a code rewrite.

---

## 7. Screens to build

For each screen, use `docs/API_ARCHITECTURE.md` for exact fields —
don't invent endpoints or payload shapes not in that document; if
something needed isn't covered there, stop and ask the user rather than
guessing a new endpoint into existence.

1. **Login / Signup** — restyled, same fields as today (email/password).
   Redirect to `/home` on success.
2. **Home** — today's date, quick stats (e.g. workouts this week), a
   prominent "Start Workout" flow: pick a split (or start empty), which
   creates a `WorkoutSession` and routes into the active logging screen.
3. **Splits** — list of the user's splits (name, muscle allocation
   summary); create/edit flow lets the user name a split and allocate
   muscles + exercise counts (same shape as today's new-split flow,
   restyled).
4. **Active workout / logging screen** (`/workout/[sessionId]`) — the
   core screen. Add an exercise (picked live from the catalog, filtered by
   the split's muscle allocation if the session came from a split), log
   sets against it with weight/reps/RIR/set-type, group two exercises into
   a superset, see the Overload Gauge per set, rest timer between sets,
   complete the workout when done. This is where mobile-first rules (§4)
   matter most — it's used mid-set, one-handed.
5. **History** — list of completed `WorkoutSession`s (swipe-to-delete,
   pull-to-refresh); tapping one opens a read-only detail view of every
   exercise/set logged, editable (correcting a past set, per
   `PATCH /sets/{id}`).
6. **Exercise detail / history** (`/exercises/[id]`) — past sets for this
   exercise over time (powers "previous logs" and prefill-from-last-set),
   with the Overload Gauge trend visible.
7. **Profile** — QR code display/upload (keep this feature, same
   `GET /users/get-qr` / `POST /users/upload-qr` endpoints), logout, and
   the "Reset demo data" action from §6.

---

## 8. Copy & voice

- Sentence case everywhere, no title case buttons.
- Buttons name the action, not a generic verb: "Start Workout," "Log Set,"
  "Complete Workout," "Delete Set" — not "Submit" or "Confirm."
- A completed action's confirmation echoes the button's own word (a "Log
  Set" tap produces a state that reads as logged, not "Success!").
- Empty states are an invitation, not an apology: e.g. an empty Splits
  list says something like "No splits yet — build one to structure your
  next workout," with the create action right there, not a sad illustration.
- Errors state what happened and what to do, in the app's own voice — no
  "Oops!," no exclamation marks.

---

## 9. Acceptance checklist

Before calling this done, verify:

- [ ] Every screen in §7 works end-to-end against the mock layer (§6),
      including create/edit/delete flows.
- [ ] No shadcn/ui import remains anywhere in the codebase.
- [ ] No hardcoded backend URL anywhere — `NEXT_PUBLIC_BASE_URL` is read
      in exactly one place (`src/lib/api/client.ts`).
- [ ] No component reads `localStorage` directly for the auth token except
      the auth module itself.
- [ ] Every touch target ≥44×44px with ≥8px spacing (spot-check the
      weight/rep steppers and the tab bar specifically).
- [ ] Bottom tab bar and any fixed bottom CTA respect
      `env(safe-area-inset-bottom)`.
- [ ] `prefers-reduced-motion` disables every non-essential animation.
- [ ] Tested at a 375px-wide viewport (iPhone SE) as the primary target,
      and spot-checked at a desktop width to confirm the centered
      max-width layout degrades gracefully.
- [ ] Lighthouse mobile performance pass is not a regression from a blank
      Next.js app (watch bundle size — MSW and font loading are the likely
      culprits if it slips).
