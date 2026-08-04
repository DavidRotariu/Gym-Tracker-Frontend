"use client";

import { MuscleAllocator } from "@/components/splits/MuscleAllocator";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { useMuscles } from "@/hooks/use-muscles";
import type { SplitInput } from "@/lib/api/splits";
import type { SplitMuscle } from "@/types";
import { useState } from "react";

interface SplitFormProps {
  initial?: { name: string; muscles: SplitMuscle[] };
  onSubmit: (input: SplitInput) => Promise<void>;
  onDelete?: () => Promise<void>;
  submitLabel: string;
}

export function SplitForm({
  initial,
  onSubmit,
  onDelete,
  submitLabel,
}: SplitFormProps) {
  const { data: muscles } = useMuscles();
  const [name, setName] = useState(initial?.name ?? "");
  const [allocation, setAllocation] = useState<SplitMuscle[]>(
    initial?.muscles ?? [],
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalExercises = allocation.reduce(
    (sum, m) => sum + m.nr_of_exercises,
    0,
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Give this split a name.");
      return;
    }
    if (allocation.length === 0) {
      setError("Pick at least one muscle group.");
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({ name: name.trim(), pic: null, muscles: allocation });
    } catch {
      setError("Couldn't save this split. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const nameError = error && !name.trim() ? error : undefined;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <TextField
        label="Split name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Push Day"
        error={nameError}
        autoComplete="off"
      />

      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <span className="text-caption font-medium text-label-secondary">
            Muscle allocation
          </span>
          {totalExercises > 0 && (
            <span className="tabular text-caption text-label-tertiary">
              {totalExercises} exercise{totalExercises === 1 ? "" : "s"}
            </span>
          )}
        </div>

        {muscles ? (
          <MuscleAllocator
            muscles={muscles}
            allocation={allocation}
            onChange={setAllocation}
          />
        ) : (
          <div className="h-64 animate-pulse rounded-card bg-fill" />
        )}
      </div>

      {error && !nameError && (
        <p className="text-caption text-red">{error}</p>
      )}

      <div className="flex flex-col gap-2">
        <Button type="submit" size="lg" block disabled={submitting}>
          {submitting ? "Saving…" : submitLabel}
        </Button>
        {onDelete && (
          <Button type="button" variant="destructive" block onClick={onDelete}>
            Delete split
          </Button>
        )}
      </div>
    </form>
  );
}
