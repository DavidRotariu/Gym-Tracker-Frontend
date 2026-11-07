"use client";

import { SplitCard } from "@/components/splits/SplitCard";
import { SplitForm } from "@/components/splits/SplitForm";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { LargeTitle } from "@/components/ui/LargeTitle";
import { Sheet } from "@/components/ui/Sheet";
import { SwipeRow } from "@/components/ui/SwipeRow";
import { useMuscles } from "@/hooks/use-muscles";
import { useCreateSplit, useDeleteSplit, useSplits } from "@/hooks/use-splits";
import { useStartOrResumeWorkout } from "@/hooks/use-workouts";
import { staggerContainer, staggerItem } from "@/lib/motion";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

export default function SplitsPage() {
  const router = useRouter();
  const { data: splits, isLoading, isError, refetch, isFetching } = useSplits();
  const { data: muscles } = useMuscles();
  const startWorkout = useStartOrResumeWorkout();
  const createSplit = useCreateSplit();
  const deleteSplit = useDeleteSplit(true);
  const [createOpen, setCreateOpen] = useState(false);
  const deletingSplits = useRef(new Set<string>());

  // Same as the home screen: resume rather than orphan a second workout —
  // and wait for the history list rather than assume nothing's in progress.
  function start(splitId: string) {
    void startWorkout.run(splitId);
  }

  return (
    <>
      <LargeTitle
        title="Splits"
        action={
          <button
            onClick={() => setCreateOpen(true)}
            aria-label="New split"
            className="relative flex size-9 cursor-pointer before:absolute before:-inset-1 before:content-[''] items-center justify-center rounded-pill text-accent-ink active:bg-accent-muted"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M10 4v12M4 10h12"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
            </svg>
          </button>
        }
      />

      {isLoading && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-card bg-fill"
            />
          ))}
        </div>
      )}

      {isError && !splits && (
        <Card flush>
          <EmptyState
            title="Couldn't load your splits"
            description="They're safe — we just couldn't reach the server. Check your connection."
            action={
              <Button onClick={() => refetch()} disabled={isFetching}>
                {isFetching ? "Retrying…" : "Try again"}
              </Button>
            }
          />
        </Card>
      )}

      {!isLoading && splits?.length === 0 && (
        <Card flush>
          <EmptyState
            title="No splits yet"
            description="Build one to structure your next workout and get a suggestion each day."
            action={
              <Button onClick={() => setCreateOpen(true)}>Create a split</Button>
            }
          />
        </Card>
      )}

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="flex flex-col gap-2"
      >
        {splits?.map((split) => (
          <motion.div key={split.id} variants={staggerItem}>
            <SwipeRow
              leadingAction={{
                label: "Edit",
                variant: "accent",
                onAction: () => router.push(`/splits/${split.id}/edit`),
              }}
              actions={[
                {
                  label: "Delete",
                  variant: "destructive",
                  onAction: () => {
                    if (
                      !deletingSplits.current.has(split.id) &&
                      window.confirm(`Delete "${split.name}"? This can't be undone.`)
                    ) {
                      deletingSplits.current.add(split.id);
                      deleteSplit.mutateAsync(split.id).catch(() => {}).finally(() => deletingSplits.current.delete(split.id));
                    }
                  },
                },
              ]}
            >
              <SplitCard
                split={split}
                muscles={muscles}
                onStart={() => start(split.id)}
                pending={startWorkout.isPending}
              />
            </SwipeRow>
          </motion.div>
        ))}
      </motion.div>

      {startWorkout.error && (
        <p role="alert" className="px-1 pt-3 text-caption text-red">
          {startWorkout.error}
        </p>
      )}

      {splits && splits.length > 0 && (
        <p className="px-1 pt-3 text-caption text-label-tertiary">
          Swipe right to edit a split, left to delete it.
        </p>
      )}

      <Sheet
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New split"
      >
        <div className="pt-1">
          <SplitForm
            submitLabel="Create split"
            onSubmit={async (input) => {
              await createSplit.mutateAsync(input);
              setCreateOpen(false);
            }}
          />
        </div>
      </Sheet>
    </>
  );
}
