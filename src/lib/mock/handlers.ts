import { http, HttpResponse, type JsonBodyType } from "msw";
import { getDb, saveDb } from "./db";
import type {
  Exercise,
  ExerciseHistoryEntry,
  LastSet,
  Set,
  Split,
  WorkoutExercise,
  WorkoutSession,
} from "@/types";

function errorResponse(status: number, code: string, message: string) {
  return HttpResponse.json({ error: { code, message } }, { status });
}

function auth(request: Request): number | null {
  const header = request.headers.get("Authorization");
  const match = header?.match(/^Bearer mock-token-(\d+)$/);
  return match ? Number(match[1]) : null;
}

function requireAuth(request: Request): number | HttpResponse<JsonBodyType> {
  const userId = auth(request);
  if (userId === null) {
    return errorResponse(401, "unauthorized", "Sign in to continue.");
  }
  return userId;
}

function isErr(v: unknown): v is HttpResponse<JsonBodyType> {
  return v instanceof HttpResponse;
}

export const handlers = [
  http.post("/auth/signup", async ({ request }) => {
    const body = (await request.json()) as { email: string; password: string };
    const db = getDb();
    if (db.users.some((u) => u.email === body.email)) {
      return errorResponse(409, "email_taken", "An account with this email already exists.");
    }
    const id = db.nextId.user++;
    db.users.push({ id, email: body.email, password: body.password, qr_code_url: null });
    saveDb(db);
    return HttpResponse.json(
      { access_token: `mock-token-${id}`, user: { id, email: body.email } },
      { status: 201 },
    );
  }),

  http.post("/auth/login", async ({ request }) => {
    const body = (await request.json()) as { email: string; password: string };
    const db = getDb();
    const user = db.users.find((u) => u.email === body.email && u.password === body.password);
    if (!user) {
      return errorResponse(401, "invalid_credentials", "Email or password is incorrect.");
    }
    return HttpResponse.json({
      access_token: `mock-token-${user.id}`,
      user: { id: user.id, email: user.email },
    });
  }),

  http.get("/muscles", () => {
    const db = getDb();
    return HttpResponse.json(db.muscles);
  }),

  http.get("/exercises", ({ request }) => {
    const db = getDb();
    const url = new URL(request.url);
    const muscleId = url.searchParams.get("muscle_id");
    let list: Exercise[] = db.exercises;
    if (muscleId) list = list.filter((e) => e.muscle_id === Number(muscleId));
    return HttpResponse.json(list);
  }),

  http.get("/exercises/:id/history", ({ params, request }) => {
    const userId = requireAuth(request);
    if (isErr(userId)) return userId;
    const exerciseId = Number(params.id);
    const db = getDb();
    const entries: ExerciseHistoryEntry[] = [];
    for (const session of db.workoutSessions) {
      if (session.user_id !== userId || !session.completed_at) continue;
      for (const we of session.exercises) {
        if (we.exercise_id !== exerciseId) continue;
        entries.push({
          workout_session_id: session.id,
          date: session.started_at,
          sets: we.sets.map((s) => ({
            set_number: s.set_number,
            set_type: s.set_type,
            actual_weight: s.actual_weight,
            actual_reps: s.actual_reps,
            actual_rir: s.actual_rir,
          })),
        });
      }
    }
    entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return HttpResponse.json(entries);
  }),

  http.get("/exercises/:id/last-set", ({ params, request }) => {
    const userId = requireAuth(request);
    if (isErr(userId)) return userId;
    const exerciseId = Number(params.id);
    const db = getDb();
    let best: { set: Set; date: string } | null = null;
    for (const session of db.workoutSessions) {
      if (session.user_id !== userId) continue;
      for (const we of session.exercises) {
        if (we.exercise_id !== exerciseId) continue;
        for (const s of we.sets) {
          if (!s.completed_at) continue;
          if (!best || new Date(s.completed_at) > new Date(best.date)) {
            best = { set: s, date: s.completed_at };
          }
        }
      }
    }
    if (!best) return new HttpResponse(null, { status: 204 });
    const result: LastSet = {
      actual_weight: best.set.actual_weight,
      actual_reps: best.set.actual_reps,
      actual_rir: best.set.actual_rir,
      logged_at: best.date,
    };
    return HttpResponse.json(result);
  }),

  http.post("/favorites", async ({ request }) => {
    const userId = requireAuth(request);
    if (isErr(userId)) return userId;
    const body = (await request.json()) as { exercise_id: number };
    const db = getDb();
    if (!db.favorites.some((f) => f.user_id === userId && f.exercise_id === body.exercise_id)) {
      db.favorites.push({ user_id: userId, exercise_id: body.exercise_id });
      saveDb(db);
    }
    return new HttpResponse(null, { status: 204 });
  }),

  http.delete("/favorites/:exerciseId", ({ params, request }) => {
    const userId = requireAuth(request);
    if (isErr(userId)) return userId;
    const exerciseId = Number(params.exerciseId);
    const db = getDb();
    db.favorites = db.favorites.filter(
      (f) => !(f.user_id === userId && f.exercise_id === exerciseId),
    );
    saveDb(db);
    return new HttpResponse(null, { status: 204 });
  }),

  http.get("/splits", ({ request }) => {
    const userId = requireAuth(request);
    if (isErr(userId)) return userId;
    const db = getDb();
    const splits = db.splits.filter((s) => s.user_id === userId).map(stripUser);
    return HttpResponse.json(splits);
  }),

  http.get("/splits/:id", ({ params, request }) => {
    const userId = requireAuth(request);
    if (isErr(userId)) return userId;
    const db = getDb();
    const split = db.splits.find((s) => s.id === Number(params.id) && s.user_id === userId);
    if (!split) return errorResponse(404, "not_found", "Split not found.");
    return HttpResponse.json(stripUser(split));
  }),

  http.post("/splits", async ({ request }) => {
    const userId = requireAuth(request);
    if (isErr(userId)) return userId;
    const body = (await request.json()) as Omit<Split, "id">;
    const db = getDb();
    const split = { id: db.nextId.split++, user_id: userId, ...body };
    db.splits.push(split);
    saveDb(db);
    return HttpResponse.json(stripUser(split), { status: 201 });
  }),

  http.put("/splits/:id", async ({ params, request }) => {
    const userId = requireAuth(request);
    if (isErr(userId)) return userId;
    const db = getDb();
    const idx = db.splits.findIndex((s) => s.id === Number(params.id) && s.user_id === userId);
    if (idx === -1) return errorResponse(404, "not_found", "Split not found.");
    const body = (await request.json()) as Omit<Split, "id">;
    db.splits[idx] = { ...db.splits[idx], ...body };
    saveDb(db);
    return HttpResponse.json(stripUser(db.splits[idx]));
  }),

  http.delete("/splits/:id", ({ params, request }) => {
    const userId = requireAuth(request);
    if (isErr(userId)) return userId;
    const db = getDb();
    db.splits = db.splits.filter((s) => !(s.id === Number(params.id) && s.user_id === userId));
    saveDb(db);
    return new HttpResponse(null, { status: 204 });
  }),

  http.post("/workouts", async ({ request }) => {
    const userId = requireAuth(request);
    if (isErr(userId)) return userId;
    const body = (await request.json().catch(() => ({}))) as { split_id?: number | null };
    const db = getDb();
    const splitId = body.split_id ?? null;
    const split = db.splits.find((s) => s.id === splitId && s.user_id === userId);

    const exercises: WorkoutExercise[] = [];
    if (split) {
      const favoriteIds = new Set(
        db.favorites.filter((f) => f.user_id === userId).map((f) => f.exercise_id),
      );
      for (const allocation of split.muscles) {
        const pool = db.exercises.filter((e) => e.muscle_id === allocation.muscle_id);
        const ordered = [
          ...pool.filter((e) => favoriteIds.has(e.id)),
          ...pool.filter((e) => !favoriteIds.has(e.id)),
        ];
        for (const exercise of ordered.slice(0, allocation.nr_of_exercises)) {
          exercises.push({
            id: db.nextId.workoutExercise++,
            exercise_id: exercise.id,
            order_index: exercises.length,
            superset_group_id: null,
            sets: [],
          });
        }
      }
    }

    const session: WorkoutSession & { user_id: number } = {
      id: db.nextId.workoutSession++,
      user_id: userId,
      split_id: splitId,
      started_at: new Date().toISOString(),
      completed_at: null,
      notes: null,
      exercises,
    };
    db.workoutSessions.push(session);
    saveDb(db);
    return HttpResponse.json(stripUser(session), { status: 201 });
  }),

  http.get("/workouts", ({ request }) => {
    const userId = requireAuth(request);
    if (isErr(userId)) return userId;
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit") ?? "50");
    const db = getDb();
    const sessions = db.workoutSessions
      .filter((s) => s.user_id === userId)
      .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
      .slice(0, limit)
      .map(({ id, split_id, started_at, completed_at, notes }) => ({
        id,
        split_id,
        started_at,
        completed_at,
        notes,
      }));
    return HttpResponse.json(sessions);
  }),

  http.get("/workouts/:id", ({ params, request }) => {
    const userId = requireAuth(request);
    if (isErr(userId)) return userId;
    const db = getDb();
    const session = db.workoutSessions.find(
      (s) => s.id === Number(params.id) && s.user_id === userId,
    );
    if (!session) return errorResponse(404, "not_found", "Workout not found.");
    return HttpResponse.json(stripUser(session));
  }),

  http.patch("/workouts/:id", async ({ params, request }) => {
    const userId = requireAuth(request);
    if (isErr(userId)) return userId;
    const db = getDb();
    const session = db.workoutSessions.find(
      (s) => s.id === Number(params.id) && s.user_id === userId,
    );
    if (!session) return errorResponse(404, "not_found", "Workout not found.");
    const patch = (await request.json()) as Partial<
      Pick<WorkoutSession, "completed_at" | "notes" | "started_at">
    >;
    Object.assign(session, patch);
    saveDb(db);
    return HttpResponse.json(stripUser(session));
  }),

  http.delete("/workouts/:id", ({ params, request }) => {
    const userId = requireAuth(request);
    if (isErr(userId)) return userId;
    const db = getDb();
    db.workoutSessions = db.workoutSessions.filter(
      (s) => !(s.id === Number(params.id) && s.user_id === userId),
    );
    saveDb(db);
    return new HttpResponse(null, { status: 204 });
  }),

  http.post("/workouts/:id/exercises", async ({ params, request }) => {
    const userId = requireAuth(request);
    if (isErr(userId)) return userId;
    const db = getDb();
    const session = db.workoutSessions.find(
      (s) => s.id === Number(params.id) && s.user_id === userId,
    );
    if (!session) return errorResponse(404, "not_found", "Workout not found.");
    const body = (await request.json()) as { exercise_id: number; order_index: number };
    const we: WorkoutExercise = {
      id: db.nextId.workoutExercise++,
      exercise_id: body.exercise_id,
      order_index: body.order_index,
      superset_group_id: null,
      sets: [],
    };
    session.exercises.push(we);
    saveDb(db);
    return HttpResponse.json(we, { status: 201 });
  }),

  http.patch("/workouts/:id/exercises/:weId", async ({ params, request }) => {
    const userId = requireAuth(request);
    if (isErr(userId)) return userId;
    const db = getDb();
    const session = db.workoutSessions.find(
      (s) => s.id === Number(params.id) && s.user_id === userId,
    );
    if (!session) return errorResponse(404, "not_found", "Workout not found.");
    const we = session.exercises.find((e) => e.id === Number(params.weId));
    if (!we) return errorResponse(404, "not_found", "Exercise not found.");
    const body = (await request.json()) as { exercise_id: number };
    we.exercise_id = body.exercise_id;
    we.sets = [];
    saveDb(db);
    return HttpResponse.json(we);
  }),

  http.delete("/workouts/:id/exercises/:weId", ({ params, request }) => {
    const userId = requireAuth(request);
    if (isErr(userId)) return userId;
    const db = getDb();
    const session = db.workoutSessions.find(
      (s) => s.id === Number(params.id) && s.user_id === userId,
    );
    if (!session) return errorResponse(404, "not_found", "Workout not found.");
    session.exercises = session.exercises.filter((e) => e.id !== Number(params.weId));
    saveDb(db);
    return new HttpResponse(null, { status: 204 });
  }),

  http.post("/workouts/:id/supersets", async ({ params, request }) => {
    const userId = requireAuth(request);
    if (isErr(userId)) return userId;
    const db = getDb();
    const session = db.workoutSessions.find(
      (s) => s.id === Number(params.id) && s.user_id === userId,
    );
    if (!session) return errorResponse(404, "not_found", "Workout not found.");
    const body = (await request.json()) as { workout_exercise_ids: number[] };
    const groupId = db.nextId.supersetGroup++;
    for (const we of session.exercises) {
      if (body.workout_exercise_ids.includes(we.id)) we.superset_group_id = groupId;
    }
    saveDb(db);
    return HttpResponse.json({ superset_group_id: groupId });
  }),

  http.delete("/workouts/:id/supersets/:groupId", ({ params, request }) => {
    const userId = requireAuth(request);
    if (isErr(userId)) return userId;
    const db = getDb();
    const session = db.workoutSessions.find(
      (s) => s.id === Number(params.id) && s.user_id === userId,
    );
    if (!session) return errorResponse(404, "not_found", "Workout not found.");
    for (const we of session.exercises) {
      if (we.superset_group_id === Number(params.groupId)) we.superset_group_id = null;
    }
    saveDb(db);
    return new HttpResponse(null, { status: 204 });
  }),

  http.post("/workout-exercises/:weId/sets", async ({ params, request }) => {
    const userId = requireAuth(request);
    if (isErr(userId)) return userId;
    const db = getDb();
    const weId = Number(params.weId);
    const session = db.workoutSessions.find(
      (s) => s.user_id === userId && s.exercises.some((e) => e.id === weId),
    );
    if (!session) return errorResponse(404, "not_found", "Exercise not found.");
    const we = session.exercises.find((e) => e.id === weId)!;
    const body = (await request.json()) as Omit<Set, "id" | "workout_exercise_id" | "completed_at">;
    const set: Set = {
      id: db.nextId.set++,
      workout_exercise_id: weId,
      completed_at: body.completed ? new Date().toISOString() : null,
      ...body,
    };
    we.sets.push(set);
    saveDb(db);
    return HttpResponse.json(set, { status: 201 });
  }),

  http.patch("/sets/:id", async ({ params, request }) => {
    const userId = requireAuth(request);
    if (isErr(userId)) return userId;
    const db = getDb();
    const setId = Number(params.id);
    let target: Set | undefined;
    for (const session of db.workoutSessions) {
      if (session.user_id !== userId) continue;
      for (const we of session.exercises) {
        const found = we.sets.find((s) => s.id === setId);
        if (found) target = found;
      }
    }
    if (!target) return errorResponse(404, "not_found", "Set not found.");
    const patch = (await request.json()) as Partial<Set>;
    Object.assign(target, patch);
    if (patch.completed && !target.completed_at) {
      target.completed_at = new Date().toISOString();
    }
    saveDb(db);
    return HttpResponse.json(target);
  }),

  http.delete("/sets/:id", ({ params, request }) => {
    const userId = requireAuth(request);
    if (isErr(userId)) return userId;
    const db = getDb();
    const setId = Number(params.id);
    for (const session of db.workoutSessions) {
      if (session.user_id !== userId) continue;
      for (const we of session.exercises) {
        we.sets = we.sets.filter((s) => s.id !== setId);
      }
    }
    saveDb(db);
    return new HttpResponse(null, { status: 204 });
  }),

  http.get("/users/get-qr", ({ request }) => {
    const userId = requireAuth(request);
    if (isErr(userId)) return userId;
    const db = getDb();
    const user = db.users.find((u) => u.id === userId);
    return HttpResponse.json({ qr_code_url: user?.qr_code_url ?? null });
  }),

  http.post("/users/upload-qr", async ({ request }) => {
    const userId = requireAuth(request);
    if (isErr(userId)) return userId;
    const db = getDb();
    const user = db.users.find((u) => u.id === userId);
    if (!user) return errorResponse(404, "not_found", "User not found.");
    const form = await request.formData();
    const file = form.get("file") as File | null;
    const url = file ? URL.createObjectURL(file) : null;
    user.qr_code_url = url;
    saveDb(db);
    return HttpResponse.json({ qr_code_url: url });
  }),
];

function stripUser<T extends { user_id: number }>(obj: T): Omit<T, "user_id"> {
  const { user_id, ...rest } = obj;
  void user_id;
  return rest;
}
