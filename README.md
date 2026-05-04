# Gym Tracker Frontend

Frontend for a gym tracking app built with Next.js. It handles authentication, QR code upload, workout split management, and communication with the backend through internal API routes.

## Tech Stack

- Next.js 15
- React 19
- TypeScript
- Tailwind CSS 4
- shadcn/ui + Radix UI
- Framer Motion
- AWS (EC2, ECR, SSM)
- Jest + ESLint

## Main Features

- Login, signup, and logout flows
- QR code upload and display
- Workout split browsing and creation
- Backend proxy routes under `/api/backend`
- Responsive mobile-first UI

## Deployment

- Deployed on AWS
- Dockerized Next.js app
- EC2 hosting with ECR image delivery and SSM-based deployment

## Project Structure

```text
.
|- src/
|  |- app/
|  |  |- api/        # Auth and backend proxy routes
|  |  |- home/       # Main logged-in experience
|  |  |- login/
|  |  |- signup/
|  |  `- new-split/
|  |- components/    # Shared UI and form components
|  `- lib/           # Auth, API client, helpers
|- public/           # Static assets
|- docs/             # Deployment notes
`- ecs/              # ECS-related files
```

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Create `.env` from `.env.example` and set:

```env
BACKEND_BASE_URL=
NEXT_PUBLIC_BASE_URL=
AUTH_COOKIE_NAME=
```

3. Start the app:

```bash
npm run dev
```

## Best Practices

- Keep secrets only in server-side environment variables.
- Route backend calls through `/api/backend` instead of calling the backend directly from the UI.
- Run `npm test` and `npm run build` before shipping changes.

For deployment details, see [docs/ecs-deployment.md](docs/ecs-deployment.md).