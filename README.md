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
- Toast notifications and polished micro-interactions (Sonner, Framer Motion)

## Tech Stack

- [Next.js 15](https://nextjs.org) (App Router) + React 19 + TypeScript
- [Supabase](https://supabase.com) for auth, database, and backend — no separate backend service
- Tailwind CSS v4 + shadcn/ui (Radix UI primitives)
- Framer Motion for animation, Sonner for toasts
- `qrcode.react` for QR generation/check-in

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

You'll need a Supabase project and the relevant environment variables (URL + anon key) configured locally to run it against real data.

## Project Structure

```
src/     # App source (pages/routes, components, logic)
public/  # Static assets
```

## License

Personal project — not currently licensed for reuse.
