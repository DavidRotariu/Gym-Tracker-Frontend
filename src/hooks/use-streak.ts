import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import * as usersApi from "@/lib/api/users";
import * as workoutsApi from "@/lib/api/workouts";
import { computeStreaks, dayKey, workoutsByDay, type RestConfig } from "@/lib/streak";
import type { RestDays, WorkoutSessionSummary } from "@/types";
import { useWorkoutHistory } from "./use-workouts";

const HEAD_PAGE = 50; // keep in sync with the limit in use-workouts' historyQuery
const REST_KEY = ["rest-days"];
const EMPTY: RestDays = { dates: [], weekdays: [] };

/**
 * The streak needs more than the 50 most recent sessions (a daily lifter has a
 * 60-day streak), so older pages are fetched lazily — and only once the cached
 * head is full, i.e. there might be more. Under ["workouts"] so finishing or
 * deleting a workout refreshes it along with the list.
 */
function useOlderSessions(head: WorkoutSessionSummary[] | undefined) {
  const full = !!head && head.length >= HEAD_PAGE;
  const oldest = full ? head[head.length - 1].started_at : undefined;
  return useQuery({
    queryKey: ["workouts", "older", oldest],
    enabled: full,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const out: WorkoutSessionSummary[] = [];
      let before = oldest;
      for (let i = 0; i < 40; i++) {
        const page = await workoutsApi.getWorkouts({ limit: 100, before });
        if (!page.length) break;
        out.push(...page);
        before = page[page.length - 1].started_at;
      }
      return out;
    },
  });
}

export function useRestDays() {
  return useQuery({ queryKey: REST_KEY, queryFn: usersApi.getRestDays });
}

/** Everything the badge and the calendar derive from, computed once per change. */
export function useStreakData() {
  const { data: head } = useWorkoutHistory();
  const { data: older } = useOlderSessions(head);
  const { data: restData = EMPTY, isError: restError, refetch: retryRest } = useRestDays();

  const sessions = useMemo(() => (older ? [...(head ?? []), ...older] : head ?? []), [head, older]);
  const workouts = useMemo(() => workoutsByDay(sessions), [sessions]);
  const rest = useMemo<RestConfig>(
    () => ({ dates: new Set(restData.dates), weekdays: new Set(restData.weekdays) }),
    [restData],
  );
  // Re-read on each data change, so a PWA left open past midnight catches up
  // at its next refetch/focus.
  const today = dayKey(new Date());
  const stats = useMemo(() => computeStreaks(workouts, rest, today), [workouts, rest, today]);

  return { workouts, rest, restData, restError, retryRest, stats, today };
}

/** Optimistic: the calendar and streak number react at once; a failed save rolls back and toasts. */
function useRestMutation<V>(
  fn: (v: V) => Promise<unknown>,
  apply: (cur: RestDays, v: V) => RestDays,
  failure: string,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: REST_KEY,
    scope: { id: "rest-days" }, // serialised, so rapid taps reach the server in order
    meta: { failure },
    mutationFn: fn,
    onMutate: async (v: V) => {
      await qc.cancelQueries({ queryKey: REST_KEY });
      const previous = qc.getQueryData<RestDays>(REST_KEY) ?? EMPTY;
      qc.setQueryData<RestDays>(REST_KEY, apply(previous, v));
      return { previous };
    },
    // Roll back to what the server last confirmed; the refetch in onSettled
    // reconciles anything queued behind it.
    onError: (_e, _v, ctx) => ctx && qc.setQueryData<RestDays>(REST_KEY, ctx.previous),
    onSettled: () => settle(qc),
  });
}

function settle(qc: QueryClient) {
  // Refetch to confirm server state once the last queued write is done.
  if (qc.isMutating({ mutationKey: REST_KEY }) <= 1) qc.invalidateQueries({ queryKey: REST_KEY });
}

export function useSetRestDate() {
  return useRestMutation<{ date: string; rest: boolean }>(
    ({ date, rest }) => usersApi.setRestDate(date, rest),
    (cur, { date, rest }) => ({
      ...cur,
      dates: rest ? [...new Set([...cur.dates, date])] : cur.dates.filter((d) => d !== date),
    }),
    "Rest day not saved.",
  );
}

export function useSetRestWeekdays() {
  return useRestMutation<number[]>(
    (weekdays) => usersApi.setRestWeekdays(weekdays),
    (cur, weekdays) => ({ ...cur, weekdays }),
    "Recurring rest days not saved.",
  );
}
