"use client";

import { SplitForm } from "@/components/splits/SplitForm";
import { LargeTitle } from "@/components/ui/LargeTitle";
import { useDeleteSplit, useSplit, useUpdateSplit } from "@/hooks/use-splits";
import { useParams, useRouter } from "next/navigation";

export default function EditSplitPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const splitId = params.id;
  const { data: split, isLoading } = useSplit(splitId);
  const updateSplit = useUpdateSplit();
  const deleteSplit = useDeleteSplit();

  return (
    <>
      <LargeTitle
        title={split?.name ?? "Edit split"}
        back="/splits"
        backLabel="Splits"
      />

      {isLoading || !split ? (
        <div className="flex flex-col gap-4">
          <div className="h-16 animate-pulse rounded-card bg-fill" />
          <div className="h-64 animate-pulse rounded-card bg-fill" />
        </div>
      ) : (
        <SplitForm
          initial={{ name: split.name, muscles: split.muscles }}
          submitLabel="Save changes"
          onSubmit={async (input) => {
            await updateSplit.mutateAsync({ id: splitId, input });
            router.push("/splits");
          }}
          onDelete={async () => {
            await deleteSplit.mutateAsync(splitId);
            router.push("/splits");
          }}
        />
      )}
    </>
  );
}
