# Gym Tracker — Backend Architecture Proposal

Status: proposed, not yet implemented. This document defines the target data
model and REST API for the backend refactor. It replaces the current ad-hoc
endpoints (see "Migration notes" at the bottom for a full diff against the
existing API).

## Design summary

- Splits remain lightweight templates: a name + a muscle/exercise-count
  allocation. The specific exercise for each slot is still chosen live,
  during the workout — not locked into the template.
- A workout is now an explicit **session**: you start it, log exercises and
  sets against it, and complete it. This replaces one-off `log-workout`
  calls with a proper session/history model.
- Each logged exercise can carry a **target** (planned weight/reps/RIR) and
  the **actual** performance per set, plus a **set type**
  (standard/warm-up/drop/failure) and optional **superset grouping**.
- No programs, cycles, periodization, gym profiles, or custom exercises in
  this iteration — deliberately out of scope for now.

---

## Entities

### Muscle *(unchanged)*

| Field | Type | Notes |
|---|---|---|
| id | integer | PK |
| name | string | |

### Exercise

| Field | Type | Notes |
|---|---|---|
| id | integer | PK |
| name | string | |
| muscle_id | integer | FK → Muscle, primary muscle |
| exercise_type | enum | `body_weight` \| `weighted` \| `negative`; existing rows migrated to `weighted` |

### ExerciseSecondaryMuscle *(join, same shape as SplitMuscle)*

| Field | Type | Notes |
|---|---|---|
| exercise_id | integer | FK → Exercise |
| muscle_id | integer | FK → Muscle |

### Split

| Field | Type | Notes |
|---|---|---|
| id | integer | PK |
| user_id | integer | FK → User, owner |
| name | string | |
| pic | string \| null | image URL/identifier |
| created_at | datetime | |

### SplitMuscle *(join, unchanged)*

| Field | Type | Notes |
|---|---|---|
| split_id | integer | FK → Split |
| muscle_id | integer | FK → Muscle |
| nr_of_exercises | integer | how many exercises of this muscle the split calls for |

### Favorite *(unchanged)*

| Field | Type | Notes |
|---|---|---|
| user_id | integer | FK → User |
| exercise_id | integer | FK → Exercise |

### WorkoutSession *(new)*

A single logged training session. Replaces the implicit "just call
`log-workout`" model.

| Field | Type | Notes |
|---|---|---|
| id | integer | PK |
| user_id | integer | FK → User |
| split_id | integer \| null | FK → Split; null for an ad-hoc/empty workout |
| started_at | datetime | set on creation |
| completed_at | datetime \| null | null while in progress |
| notes | string \| null | session-level note |

### WorkoutExercise *(new)*

One exercise picked live during a session.

| Field | Type | Notes |
|---|---|---|
| id | integer | PK |
| workout_session_id | integer | FK → WorkoutSession |
| exercise_id | integer | FK → Exercise |
| order_index | integer | position within the session |
| superset_group_id | integer \| null | shared value across WorkoutExercises that are supersetted together |

### Set *(new — replaces the old flat log-workout row)*

| Field | Type | Notes |
|---|---|---|
| id | integer | PK |
| workout_exercise_id | integer | FK → WorkoutExercise |
| set_number | integer | order within the exercise |
| set_type | enum | `standard` \| `warmup` \| `drop` \| `failure` |
| target_weight | number \| null | planned |
| target_reps | integer \| null | planned |
| target_rir | integer \| null | planned reps-in-reserve, 0–6+ |
| actual_weight | number \| null | logged |
| actual_reps | integer \| null | logged |
| actual_rir | integer \| null | logged, 0–6+ |
| completed | boolean | default false |
| completed_at | datetime \| null | |

### User *(unchanged)*

| Field | Type | Notes |
|---|---|---|
| id | integer | PK |
| email | string | |
| password_hash | string | |
| qr_code_url | string \| null | |
| profile_picture_url | string \| null | |

---

## API

All endpoints except `/auth/*` require `Authorization: Bearer <token>`.
All request/response bodies are JSON. Errors use
`{ "error": { "code": string, "message": string } }` with a matching HTTP
status (400/401/403/404/409/500).

### Auth

**`POST /auth/signup`**
```json
// request
{ "email": "string", "password": "string" }
// response 201
{ "access_token": "string", "user": { "id": 1, "email": "string" } }
```

**`POST /auth/login`**
```json
// request
{ "email": "string", "password": "string" }
// response 200
{ "access_token": "string", "user": { "id": 1, "email": "string" } }
```

### Muscles

**`GET /muscles`**
```json
// response 200
[ { "id": 1, "name": "Chest" }, ... ]
```

### Exercises

**`GET /exercises?muscle_id={id}`**
```json
// response 200
[
  {
    "id": 10,
    "name": "Bench Press",
    "muscle_id": 1,
    "exercise_type": "weighted",
    "secondary_muscles": [ { "id": 3, "name": "Shoulders" }, { "id": 7, "name": "Triceps" } ]
  }
]
```

**`PATCH /exercises/{exercise_id}`** — any subset of fields.
```json
// request (any subset)
{
  "name": "Barbell Bench Press",
  "pic": "string|null",
  "tips": "string|null",
  "equipment": "string|null",
  "exercise_type": "weighted",
  "muscle_id": 1,
  "favorite": true,
  "secondary_muscles": [3, 7]
}
// response 200 — same shape as GET /exercises item
```

**`GET /exercises/{id}/history?limit=&before=`**

Past logged sets for this exercise, most recent first. Powers the
"previous logs" view.
```json
// response 200
[
  {
    "workout_session_id": 55,
    "date": "2026-08-01T18:32:00Z",
    "sets": [
      { "set_number": 1, "set_type": "standard", "actual_weight": 80, "actual_reps": 8, "actual_rir": 2 }
    ]
  }
]
```

**`GET /exercises/{id}/last-set`**

Most recent single set logged for this exercise — used to prefill
weight/reps when starting a new one (autolog-last-workout-weights).
```json
// response 200
{ "actual_weight": 80, "actual_reps": 8, "actual_rir": 2, "logged_at": "2026-08-01T18:32:00Z" }
// or 204 No Content if never logged
```

### Favorites

**`POST /favorites`**
```json
// request
{ "exercise_id": 10 }
// response 204
```

**`DELETE /favorites/{exerciseId}`**
```json
// response 204
```

### Splits

**`GET /splits`**
```json
// response 200
[
  {
    "id": 3,
    "name": "Push Day",
    "pic": "string|null",
    "muscles": [ { "muscle_id": 1, "nr_of_exercises": 3 } ]
  }
]
```

**`POST /splits`**
```json
// request
{
  "name": "Push Day",
  "pic": "string|null",
  "muscles": [ { "muscle_id": 1, "nr_of_exercises": 3 } ]
}
// response 201 — same shape as GET item, with id
```

**`GET /splits/{id}`** — single split, same shape as list item.

**`PUT /splits/{id}`** — same body as POST, replaces name/pic/muscles.

**`DELETE /splits/{id}`**
```json
// response 204
```

### Workout sessions

**`POST /workouts`** — start a session.
```json
// request
{ "split_id": 3 }   // omit or null for an ad-hoc workout
// response 201
{ "id": 55, "split_id": 3, "started_at": "2026-08-04T18:00:00Z", "completed_at": null, "notes": null, "exercises": [] }
```

**`GET /workouts?limit=&before=`** — session history, most recent first.
```json
// response 200
[ { "id": 55, "split_id": 3, "started_at": "...", "completed_at": "...", "notes": null } ]
```

**`GET /workouts/{id}`** — full session detail including exercises and sets.
```json
// response 200
{
  "id": 55,
  "split_id": 3,
  "started_at": "2026-08-04T18:00:00Z",
  "completed_at": "2026-08-04T19:10:00Z",
  "notes": "felt strong",
  "exercises": [
    {
      "id": 200,
      "exercise_id": 10,
      "order_index": 0,
      "superset_group_id": null,
      "sets": [
        {
          "id": 900, "set_number": 1, "set_type": "warmup",
          "target_weight": 60, "target_reps": 10, "target_rir": null,
          "actual_weight": 60, "actual_reps": 10, "actual_rir": null,
          "completed": true, "completed_at": "2026-08-04T18:05:00Z"
        }
      ]
    }
  ]
}
```

**`PATCH /workouts/{id}`** — complete the session, or edit its
notes/start time/duration (for backfilling/editing history).
```json
// request (any subset)
{ "completed_at": "2026-08-04T19:10:00Z", "notes": "felt strong", "started_at": "2026-08-04T18:00:00Z" }
// response 200 — updated session
```

**`DELETE /workouts/{id}`**
```json
// response 204
```

### Workout exercises

**`POST /workouts/{id}/exercises`** — add an exercise picked live during
the session.
```json
// request
{ "exercise_id": 10, "order_index": 0 }
// response 201
{ "id": 200, "exercise_id": 10, "order_index": 0, "superset_group_id": null, "sets": [] }
```

**`DELETE /workouts/{id}/exercises/{workoutExerciseId}`**
```json
// response 204
```

**`POST /workouts/{id}/supersets`** — group existing exercises in this
session into a superset (pass their `WorkoutExercise` ids).
```json
// request
{ "workout_exercise_ids": [200, 201] }
// response 200
{ "superset_group_id": 42 }
```

**`DELETE /workouts/{id}/supersets/{supersetGroupId}`** — ungroup.
```json
// response 204
```

### Sets

**`POST /workout-exercises/{workoutExerciseId}/sets`** — log a set.
```json
// request
{
  "set_number": 1,
  "set_type": "standard",
  "target_weight": 80, "target_reps": 8, "target_rir": 2,
  "actual_weight": 80, "actual_reps": 8, "actual_rir": 2,
  "completed": true
}
// response 201 — the created Set
```

**`PATCH /sets/{id}`** — edit any field (e.g. correcting a past log).
```json
// request (any subset of Set fields)
{ "actual_weight": 82.5 }
// response 200 — the updated Set
```

**`DELETE /sets/{id}`**
```json
// response 204
```

### Users

**`GET /users/get-qr`**
```json
// response 200
{ "qr_code_url": "string|null" }
```

**`POST /users/upload-qr`** — `multipart/form-data`, field `file`.
```json
// response 200
{ "qr_code_url": "string" }
```

**`POST /users/profile-picture`** — `multipart/form-data`, field `file`.
JPEG/PNG/WebP only, 5 MB max; anything else is `400`.
```json
// response 200
{ "profile_picture_url": "string" }
```

**`GET /users/profile-picture`**
```json
// response 200
{ "profile_picture_url": "string" }
// or 204 No Content if none set
```

**`DELETE /users/profile-picture`**
```json
// response 204
```

---

## Migration notes (diff against current API)

- `POST /log-workout` → replaced by the session flow:
  `POST /workouts` → `POST /workouts/{id}/exercises` →
  `POST /workout-exercises/{id}/sets` → `PATCH /workouts/{id}` to complete.
- `GET /workouts/by-exercise?exercise_id=` → `GET /exercises/{id}/history`.
- `DELETE /workouts?workout_id=` → `DELETE /workouts/{id}` now deletes a
  whole session; deleting a single set is `DELETE /sets/{id}`.
- `GET /exercises/by-muscle/{muscleId}` → `GET /exercises?muscle_id={id}`
  (query param instead of path segment, for consistency with `history`).
- `POST /favorites/add?exercise_id=` / `DELETE /favorites/remove?exercise_id=`
  → `POST /favorites` (body) / `DELETE /favorites/{exerciseId}` (path param),
  to stop mixing query params and bodies across the API.
- Splits (`GET/POST /splits`, `DELETE /splits/{id}`) are functionally
  unchanged; `PUT /splits/{id}` and `GET /splits/{id}` are newly added so
  the frontend can edit a split without recreating it.
- New: `GET /exercises/{id}/last-set` (formalizes the ad-hoc "autolog last
  workout weights" logic currently duplicated in the frontend).
- Two hardcoded production URLs in the current frontend
  (`signup-form.tsx`, `new-split/page.tsx`'s muscle fetch) should be
  replaced with `NEXT_PUBLIC_BASE_URL` once the frontend refactor lands —
  not a backend change, noted here so it isn't lost.
- The three unused Next.js API proxy routes under `src/app/api/` can be
  deleted; nothing calls them and this architecture calls the backend
  directly, same as today.
