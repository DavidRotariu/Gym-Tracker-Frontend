"use client";

import { Button } from "@/components/ui/Button";
import { MediaThumb } from "@/components/ui/MediaThumb";
import { MuscleChips } from "@/components/ui/MuscleChips";
import { useMuscles } from "@/hooks/use-muscles";
import { useSplits } from "@/hooks/use-splits";
import { useQrImage } from "@/hooks/use-users";
import { useStartWorkout, useWorkoutHistory } from "@/hooks/use-workouts";
import { suggestSplit } from "@/lib/format";
import { getSplitIcon } from "@/lib/splitIcon";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const SHOWN_KEY = "overload_launch_shown";

/**
 * The first thing you actually need at the gym door is your QR code and to
 * know what you're training — not the app's usual home feed. Shows once per
 * browser session (sessionStorage, not a one-time "onboarding" flag — this
 * is meant to greet every fresh visit, not just the very first ever) and
 * only when there's an actual suggestion to make; a brand-new account with
 * no splits yet has nothing to gate on and goes straight to Home.
 */
export function LaunchGate() {
  const router = useRouter();
  const { data: splits, isLoading: splitsLoading } = useSplits();
  const { data: history, isLoading: historyLoading } = useWorkoutHistory();
  const { data: muscles } = useMuscles();
  const { url: qrUrl } = useQrImage(true);
  const startWorkout = useStartWorkout();

  const [alreadyShown] = useState(
    () => typeof window !== "undefined" && sessionStorage.getItem(SHOWN_KEY) === "1",
  );

  const loading = splitsLoading || historyLoading;
  const suggested = useMemo(() => suggestSplit(splits, history), [splits, history]);
  const muscleLookup = useMemo(
    () => new Map(muscles?.map((m) => [m.id, m.name])),
    [muscles],
  );
  const splitIcon = suggested ? getSplitIcon(suggested.name) : undefined;

  const skip = !loading && (alreadyShown || !suggested);

  useEffect(() => {
    if (loading) return;
    if (alreadyShown || !suggested) {
      router.replace("/home");
      return;
    }
    sessionStorage.setItem(SHOWN_KEY, "1");
  }, [loading, alreadyShown, suggested, router]);

  if (loading || skip) {
    // Deliberately blank rather than a skeleton — this gate resolves in one
    // query round-trip (usually already warm from a previous visit), and a
    // flash of placeholder UI would be more distracting than a beat of black.
    return <div className="fixed inset-0 z-50 bg-background" />;
  }

  async function start() {
    const session = await startWorkout.mutateAsync(suggested!.id);
    router.replace(`/workout/${session.id}`);
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-50 flex flex-col bg-background px-6 pt-[calc(env(safe-area-inset-top)+40px)] pb-[calc(env(safe-area-inset-bottom)+24px)]"
    >
      <div className="flex flex-1 flex-col items-center justify-center gap-8">
        {qrUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={qrUrl}
            alt="Your gym QR code"
            className="size-52 rounded-card bg-white object-contain p-3 shadow-sheet"
          />
        ) : (
          <div className="flex size-52 items-center justify-center rounded-card border border-dashed border-separator text-center text-caption text-label-tertiary">
            Add your gym QR in Profile
          </div>
        )}

        <div className="flex flex-col items-center gap-3 text-center">
          <p className="text-kicker text-label-tertiary uppercase">Up next</p>
          <div className="flex items-center gap-2.5">
            {splitIcon && (
              <MediaThumb
                src={splitIcon}
                alt=""
                static
                fallback={<span />}
                className="size-9 shrink-0 rounded-control object-contain"
              />
            )}
            <h1 className="font-display text-large-title text-label">
              It&rsquo;s {suggested!.name}!
            </h1>
          </div>
          <MuscleChips muscles={suggested!.muscles} lookup={muscleLookup} />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <Button
          size="lg"
          block
          onClick={start}
          disabled={startWorkout.isPending}
        >
          {startWorkout.isPending ? "Starting…" : "Let's do it!"}
        </Button>
        <Button size="lg" block variant="secondary" onClick={() => router.replace("/home")}>
          Home screen
        </Button>
      </div>
    </motion.div>
  );
}
