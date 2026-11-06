# Gym Tracker

*An app for the bros.* A personal workout tracker built to log training sessions, track progress over time, and check in via QR code — built for myself, now used by a few friends too.

**Live:** [gym-tracker-topaz.vercel.app](https://gym-tracker-topaz.vercel.app)

<!-- Add a screenshot or short demo GIF here, e.g.:
![Gym Tracker dashboard](./public/screenshot-dashboard.png)
-->

## Overview

Most workout-tracking apps are either bloated with features nobody uses or too clunky to actually log a set between reps. Gym Tracker is a minimal, fast tool built around what I actually wanted: logging exercises/sets/reps/weight quickly, seeing progress over time, and a QR-code check-in flow.

Built solo as a personal side project — now used day-to-day by me and a few friends.

## Features

- **Workout logging** — log exercises, sets, reps, and weight per session
- **Progress tracking** — view training history and progress over time
- **QR check-in** — quick check-in flow via QR code
- **Auth** — email/password accounts, so each user's data is private
- **Resilient saving** — edits apply instantly, are sent in order, roll back individually on failure, and say whether they saved

## Tech Stack

- [Next.js 16](https://nextjs.org) (App Router) + React 19 + TypeScript
- TanStack Query for server state and the ordered, optimistic write queue
- Tailwind CSS v4, Framer Motion
- A separate REST API (`NEXT_PUBLIC_BASE_URL`) for auth and data
- MSW powers an optional in-browser demo backend (`NEXT_PUBLIC_USE_MOCKS=true`)

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

Environment (`.env.local`):

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_BASE_URL` | Base URL of the API (empty with mocks: same origin). |
| `NEXT_PUBLIC_USE_MOCKS` | `true` runs against the in-browser demo backend (demo login pre-filled). Leave unset for a real build — none of the demo code ships. |

Scripts: `npm run typecheck`, `npm test` (Node's built-in runner), `npm run lint`, `npm run build`.

In a demo build, simulate bad networks from the browser console (see `docs/QA_AUDIT.md`): `localStorage.overload_mock_latency = "800"`, `overload_mock_fail = "PATCH /sets/"`, `overload_mock_offline = "1"`, `overload_mock_expired = "1"`.

`docs/QA_AUDIT.md` is the QA/reliability audit and the source of truth for known issues.

## Project Structure

```
src/     # App source (pages/routes, components, logic)
public/  # Static assets
```

## License

Personal project — not currently licensed for reuse.
