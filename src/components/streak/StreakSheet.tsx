"use client";

import { Sheet } from "@/components/ui/Sheet";
import { useStreakData, useSetRestDate, useSetRestWeekdays } from "@/hooks/use-streak";
import { useSplits } from "@/hooks/use-splits";
import { formatDuration } from "@/lib/format";
import { playCompleteFeedback } from "@/lib/feedback";
import {
  addDays,
  dayKey,
  dayKind,
  milestoneFor,
  parseKey,
  streakCopy,
  type DayKind,
} from "@/lib/streak";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";

const FLAME =
  "M10 1.5c.6 2.4-.4 3.9-1.7 5.3C7 8 5.8 9.3 5.8 11.4a4.2 4.2 0 0 0 8.4 0c0-1.3-.5-2.2-1-3 .9.3 2.3 1.5 2.3 4a5.5 5.5 0 1 1-11 0c0-4.6 3.2-6.6 5.5-10.9Z";

/** A number that rolls to its new value instead of snapping. */
export function RollingNumber({ value, className }: { value: number | string; className?: string }) {
  return (
    <span className={cn("tabular relative inline-grid", className)}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -10, opacity: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="col-start-1 row-start-1"
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

export function StreakBadge() {
  const { stats } = useStreakData();
  const [open, setOpen] = useState(false);
  const streak = stats.current;
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          // Safari doesn't focus a button on click; the sheet returns focus to
          // whatever was focused when it opened.
          e.currentTarget.focus({ preventScroll: true });
          setOpen(true);
        }}
        aria-label={`${streak} day streak. Open consistency calendar`}
        aria-haspopup="dialog"
        className="flex cursor-pointer items-center gap-1 overflow-hidden rounded-pill bg-fill py-1 pr-2 pl-2 transition-transform active:scale-95"
      >
        <motion.svg
          width="16"
          height="16"
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden
          // Only a live streak pulses; a flame that never stops moving next to a
          // "0" reads as noise.
          animate={streak > 0 ? { scale: [1, 1.08, 1] } : undefined}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        >
          <path d={FLAME} fill="var(--color-accent)" />
        </motion.svg>
        <RollingNumber value={streak} className="text-caption font-bold text-label" />
        <span className="text-caption font-bold text-label">streak</span>
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden className="ml-0.5 text-label-tertiary">
          <path d="M2.5 1l3 3-3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Consistency">
        <StreakContent onClose={() => setOpen(false)} />
      </Sheet>
    </>
  );
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WEEKDAY_JS = [1, 2, 3, 4, 5, 6, 0]; // Monday-first column → JS getDay()

const fmtLong = (key: string) =>
  parseKey(key).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

function StreakContent({ onClose }: { onClose: () => void }) {
  const { workouts, rest, restData, restError, retryRest, stats, today } = useStreakData();
  const setRestDate = useSetRestDate();
  const setWeekdays = useSetRestWeekdays();
  const { data: splits } = useSplits();

  const todayDate = parseKey(today);
  const thisMonth = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1);
  const [month, setMonth] = useState(thisMonth);
  const [dir, setDir] = useState(1);
  const [selected, setSelected] = useState(today);
  const gridRef = useRef<HTMLDivElement>(null);

  const first = useMemo(() => {
    let f: string | null = null;
    for (const k of workouts.keys()) if (f === null || k < f) f = k;
    return f;
  }, [workouts]);

  // History bounds the back button; one month ahead is as far as it goes.
  const earliest = [first, ...restData.dates].filter((k): k is string => !!k).sort()[0] ?? today;
  const monthIdx = (d: Date) => d.getFullYear() * 12 + d.getMonth();
  const canPrev = monthIdx(month) > monthIdx(parseKey(earliest));
  const canNext = monthIdx(month) < monthIdx(thisMonth) + 1;
  const go = (n: number) => {
    setDir(n);
    setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));
  };

  const monthKey = dayKey(month).slice(0, 7);
  const workoutsInMonth = useMemo(() => {
    let n = 0;
    for (const [k, list] of workouts) if (k.startsWith(monthKey)) n += list.length;
    return n;
  }, [workouts, monthKey]);

  // 6 rows always, so the sheet doesn't jump between 5- and 6-week months.
  const offset = (month.getDay() + 6) % 7;
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: 42 }, (_, i) => {
    const n = i - offset + 1;
    return n >= 1 && n <= daysInMonth ? `${monthKey}-${String(n).padStart(2, "0")}` : null;
  });

  const kindOf = (k: string): DayKind => dayKind(k, workouts, rest, today, first);
  const inChain = (k: string | null) => !!k && stats.chain.has(k);

  function onGridKey(e: React.KeyboardEvent) {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (!step) return;
    e.preventDefault();
    const next = addDays(selected, step);
    if (next.slice(0, 7) !== monthKey) return; // month switching stays on the arrows
    setSelected(next);
    requestAnimationFrame(() => gridRef.current?.querySelector<HTMLElement>(`[data-day="${next}"]`)?.focus());
  }

  const milestone = milestoneFor(stats.current);
  const monthLabel = month.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const isThisMonth = month.getTime() === thisMonth.getTime();

  return (
    <div className="flex flex-col gap-5 pb-2">
      {/* Summary ------------------------------------------------------- */}
      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
        className="flex items-center gap-4"
      >
        <svg width="44" height="44" viewBox="0 0 20 20" fill="none" aria-hidden className="shrink-0">
          <path d={FLAME} fill={stats.current > 0 ? "var(--color-accent)" : "var(--color-fill-strong)"} />
        </svg>
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <RollingNumber value={stats.current} className="text-stat text-label" />
            <span className="text-body font-semibold text-label">day streak</span>
          </div>
          <p className="text-subhead text-label-secondary">
            {milestone ? (
              <span className="font-semibold text-accent-ink">{milestone} · </span>
            ) : null}
            {streakCopy(stats.current)}
          </p>
        </div>
      </motion.div>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Best streak" value={stats.best} unit={stats.best === 1 ? "day" : "days"} />
        <Stat label={isThisMonth ? "This month" : month.toLocaleDateString(undefined, { month: "long" })} value={workoutsInMonth} unit={workoutsInMonth === 1 ? "workout" : "workouts"} />
        <Stat label="Last 30 days" value={stats.consistency === null ? "—" : `${stats.consistency}%`} unit="consistent" />
      </div>

      {restError && (
        <p role="alert" className="rounded-control bg-warning-soft px-3 py-2 text-caption text-warning">
          Couldn&apos;t load your rest days, so the streak may look shorter than it is.{" "}
          <button type="button" onClick={() => void retryRest()} className="cursor-pointer font-semibold underline">
            Retry
          </button>
        </p>
      )}

      {/* Calendar ------------------------------------------------------ */}
      <section aria-label="Training calendar">
        <div className="mb-2 flex items-center justify-between">
          <NavButton label="Previous month" disabled={!canPrev} onClick={() => go(-1)} flip />
          <h3 className="text-body font-semibold text-label" aria-live="polite">
            {monthLabel}
          </h3>
          <NavButton label="Next month" disabled={!canNext} onClick={() => go(1)} />
        </div>

        <div className="grid grid-cols-7 pb-1" aria-hidden>
          {WEEKDAYS.map((d) => (
            <span key={d} className="text-center text-tab font-semibold uppercase tracking-wider text-label-tertiary">
              {d}
            </span>
          ))}
        </div>

        <AnimatePresence mode="wait" initial={false} custom={dir}>
          <motion.div
            key={monthKey}
            ref={gridRef}
            role="group"
            aria-label={monthLabel}
            custom={dir}
            variants={{
              enter: (d: number) => ({ opacity: 0, x: d * 20 }),
              center: { opacity: 1, x: 0 },
              exit: (d: number) => ({ opacity: 0, x: d * -20 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.16, ease: "easeOut" }}
            onKeyDown={onGridKey}
            className="grid grid-cols-7"
          >
            {cells.map((k, i) =>
              k === null ? (
                <span key={i} className="h-11" />
              ) : (
                <DayCell
                  key={k}
                  dayKey={k}
                  col={i % 7}
                  kind={kindOf(k)}
                  isToday={k === today}
                  selected={k === selected}
                  chain={inChain(k)}
                  prevChain={i % 7 > 0 && inChain(cells[i - 1])}
                  nextChain={i % 7 < 6 && inChain(cells[i + 1])}
                  streak={stats.current}
                  tabbable={k === selected || (selected.slice(0, 7) !== monthKey && k === `${monthKey}-01`)}
                  onSelect={() => setSelected(k)}
                />
              ),
            )}
          </motion.div>
        </AnimatePresence>

        <Legend />
      </section>

      {/* Selected day -------------------------------------------------- */}
      <div className="min-h-[96px] rounded-card bg-fill p-4" aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={selected}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
          >
            <DayDetail
              dayKey={selected}
              kind={kindOf(selected)}
              sessions={workouts.get(selected)}
              scheduled={rest.weekdays.has(parseKey(selected).getDay())}
              explicit={rest.dates.has(selected)}
              splitName={(id) => splits?.find((s) => s.id === id)?.name}
              onClose={onClose}
              onToggleRest={(on) => {
                if (on) playCompleteFeedback();
                setRestDate.mutate({ date: selected, rest: on });
              }}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Recurring rest days: secondary, collapsed -------------------- */}
      <details className="group rounded-card bg-fill">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-4 text-subhead font-semibold text-label [&::-webkit-details-marker]:hidden">
          Recurring rest days
          <span className="text-caption font-normal text-label-secondary">
            {restData.weekdays.length
              ? WEEKDAY_JS.filter((d) => restData.weekdays.includes(d)).map((d) => WEEKDAYS[WEEKDAY_JS.indexOf(d)]).join(", ")
              : "None"}
          </span>
        </summary>
        <div className="px-4 pb-4">
          <div className="flex gap-1">
            {WEEKDAYS.map((name, col) => {
              const js = WEEKDAY_JS[col];
              const on = restData.weekdays.includes(js);
              return (
                <button
                  key={name}
                  type="button"
                  aria-pressed={on}
                  aria-label={`${name} is a ${on ? "" : "not a "}rest day`}
                  onClick={() =>
                    setWeekdays.mutate(on ? restData.weekdays.filter((d) => d !== js) : [...restData.weekdays, js].sort())
                  }
                  className={cn(
                    "h-11 flex-1 cursor-pointer rounded-control text-caption font-semibold transition-colors",
                    on ? "bg-accent-muted text-accent-ink ring-1 ring-accent" : "bg-background-elevated text-label-secondary",
                  )}
                >
                  {name[0]}
                  <span className="sr-only">{name.slice(1)}</span>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-caption text-label-secondary">
            These days keep your streak going unless you train, in which case they count as workouts.
          </p>
        </div>
      </details>
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: number | string; unit: string }) {
  return (
    <div className="rounded-card bg-fill px-3 py-3">
      <RollingNumber value={value} className="text-stat-sm text-label" />
      <p className="text-caption text-label-secondary">{unit}</p>
      <p className="text-tab font-semibold uppercase tracking-wider text-label-tertiary">{label}</p>
    </div>
  );
}

function NavButton({ label, disabled, onClick, flip }: { label: string; disabled: boolean; onClick: () => void; flip?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-11 cursor-pointer items-center justify-center rounded-pill text-label-secondary enabled:active:bg-fill disabled:opacity-30"
    >
      <svg width="10" height="14" viewBox="0 0 8 12" fill="none" aria-hidden className={flip ? "rotate-180" : undefined}>
        <path d="M1.5 1.5l4.5 4.5-4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

function Legend() {
  return (
    <ul className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-caption text-label-secondary">
      <li className="flex items-center gap-1.5"><span className="size-2.5 rounded-pill bg-accent" />Workout</li>
      <li className="flex items-center gap-1.5"><span className="size-2.5 rounded-pill border-2 border-label-tertiary" />Rest</li>
      <li className="flex items-center gap-1.5"><span className="size-2.5 rounded-pill bg-red-soft ring-1 ring-red-strong/40" />Missed</li>
    </ul>
  );
}

const KIND_LABEL: Record<DayKind, string> = {
  workout: "Workout day",
  rest: "Rest day",
  missed: "Missed day",
  pending: "Today, no workout yet",
  future: "Upcoming",
  before: "No data",
};

function DayCell(props: {
  dayKey: string;
  col: number;
  kind: DayKind;
  isToday: boolean;
  selected: boolean;
  chain: boolean;
  prevChain: boolean;
  nextChain: boolean;
  streak: number;
  tabbable: boolean;
  onSelect: () => void;
}) {
  const { kind, isToday, chain } = props;
  const label = `${fmtLong(props.dayKey)}. ${KIND_LABEL[kind]}${isToday && kind !== "pending" ? ", today" : ""}.${
    chain ? ` Part of current ${props.streak} day streak.` : ""
  }`;
  const circle: Record<DayKind, string> = {
    workout: "bg-accent font-bold text-accent-foreground",
    rest: "border-2 border-label-tertiary text-label-secondary",
    missed: "bg-red-soft text-label-secondary",
    pending: "text-label",
    future: "text-label-tertiary",
    before: "text-label-tertiary",
  };
  return (
    <button
      type="button"
      data-day={props.dayKey}
      aria-label={label}
      aria-current={isToday ? "date" : undefined}
      aria-pressed={props.selected}
      disabled={kind === "future"}
      tabIndex={props.tabbable ? 0 : -1}
      onClick={props.onSelect}
      className="group relative flex h-11 cursor-pointer items-center justify-center outline-none disabled:cursor-default"
    >
      {chain && props.prevChain && <span className="absolute inset-y-1.5 right-1/2 left-0 bg-accent-muted" aria-hidden />}
      {chain && props.nextChain && <span className="absolute inset-y-1.5 right-0 left-1/2 bg-accent-muted" aria-hidden />}
      <span
        className={cn(
          "tabular relative z-10 flex size-9 items-center justify-center rounded-pill text-subhead transition-colors duration-200",
          circle[kind],
          isToday && "ring-2 ring-accent ring-offset-2 ring-offset-background-elevated",
          "group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-label",
        )}
      >
        {Number(props.dayKey.slice(8))}
        {kind === "rest" && (
          <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden className="absolute -right-0.5 -bottom-0.5 rounded-pill bg-background-elevated text-label-secondary">
            <path d="M6.5 1a4 4 0 1 0 2.5 6.6A3.2 3.2 0 0 1 6.5 1Z" fill="currentColor" />
          </svg>
        )}
        {kind === "missed" && (
          <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden className="absolute -right-0.5 -bottom-0.5 rounded-pill bg-background-elevated text-red-strong">
            <path d="M2.5 2.5l5 5M7.5 2.5l-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        )}
      </span>
      {props.selected && <span className="absolute bottom-0 h-0.5 w-3 rounded-pill bg-label" aria-hidden />}
    </button>
  );
}

function DayDetail(props: {
  dayKey: string;
  kind: DayKind;
  sessions: { id: string; split_id: string | null; started_at: string; completed_at: string | null }[] | undefined;
  scheduled: boolean;
  explicit: boolean;
  splitName: (id: string) => string | undefined;
  onClose: () => void;
  onToggleRest: (on: boolean) => void;
}) {
  const { kind } = props;
  const action = (label: string, on: boolean) => (
    <button
      type="button"
      onClick={() => props.onToggleRest(on)}
      className="mt-2 inline-flex h-11 cursor-pointer items-center rounded-button bg-background-elevated px-4 text-subhead font-semibold text-label active:opacity-60"
    >
      {label}
    </button>
  );
  let body: React.ReactNode;
  if (kind === "workout") {
    body = (
      <>
        <p className="text-subhead font-semibold text-label">✓ Workout completed</p>
        <ul className="mt-1 flex flex-col gap-1">
          {props.sessions?.map((s) => (
            <li key={s.id} className="flex min-h-11 items-center justify-between gap-3">
              <span className="text-subhead text-label-secondary">
                {(s.split_id && props.splitName(s.split_id)) || "Workout"} · {formatDuration(s.started_at, s.completed_at)}
              </span>
              <Link href={`/history/${s.id}`} onClick={props.onClose} className="text-subhead font-semibold text-accent-ink">
                View workout
              </Link>
            </li>
          ))}
        </ul>
      </>
    );
  } else if (kind === "rest") {
    const viaWeekday = props.scheduled;
    body = (
      <>
        <p className="text-subhead font-semibold text-label">○ {viaWeekday ? "Scheduled rest day" : "Rest day"}</p>
        <p className="text-caption text-label-secondary">
          This day doesn&apos;t break your streak.
          {viaWeekday && " Change it under Recurring rest days."}
        </p>
        {!viaWeekday && props.explicit && action("Remove rest day", false)}
      </>
    );
  } else if (kind === "missed") {
    body = (
      <>
        <p className="text-subhead font-semibold text-label">× No workout</p>
        <p className="text-caption text-label-secondary">This day broke your streak.</p>
        {action("Mark as rest day", true)}
      </>
    );
  } else if (kind === "pending") {
    body = (
      <>
        <p className="text-subhead font-semibold text-label">No workout yet</p>
        <p className="text-caption text-label-secondary">Your streak is safe until the day ends.</p>
        {action("Mark as rest day", true)}
      </>
    );
  } else if (kind === "future") {
    body = <p className="text-subhead text-label-secondary">Nothing here yet.</p>;
  } else {
    body = <p className="text-subhead text-label-secondary">Before you started tracking.</p>;
  }
  return (
    <>
      <p className="mb-1 text-kicker uppercase text-label-tertiary">{fmtLong(props.dayKey)}</p>
      {body}
    </>
  );
}
