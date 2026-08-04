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
import { useStartWorkout } from "@/hooks/use-workouts";
import { staggerContainer, staggerItem } from "@/lib/motion";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SplitsPage() {
  const router = useRouter();
  const { data: splits, isLoading } = useSplits();
  const { data: muscles } = useMuscles();
  const startWorkout = useStartWorkout();
  const createSplit = useCreateSplit();
  const deleteSplit = useDeleteSplit();
  const [createOpen, setCreateOpen] = useState(false);

  async function start(splitId: number) {
    const session = await startWorkout.mutateAsync(splitId);
    router.push(`/workout/${session.id}`);
  }

  return (
    <>
      <LargeTitle
        title="Splits"
        action={
          <button
            onClick={() => setCreateOpen(true)}
            aria-label="New split"
            className="flex size-9 cursor-pointer items-center justify-center rounded-pill text-accent-ink active:bg-accent-muted"
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
              actions={[
                {
                  label: "Edit",
                  variant: "neutral",
                  onAction: () => router.push(`/splits/${split.id}/edit`),
                },
                {
                  label: "Delete",
                  variant: "destructive",
                  onAction: () => deleteSplit.mutate(split.id),
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

      {splits && splits.length > 0 && (
        <p className="px-1 pt-3 text-caption text-label-tertiary">
          Swipe a split left to edit or delete it.
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
