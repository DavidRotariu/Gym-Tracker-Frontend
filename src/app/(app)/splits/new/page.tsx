"use client";

import { SplitForm } from "@/components/splits/SplitForm";
import { LargeTitle } from "@/components/ui/LargeTitle";
import { useCreateSplit } from "@/hooks/use-splits";
import { useRouter } from "next/navigation";

export default function NewSplitPage() {
  const router = useRouter();
  const createSplit = useCreateSplit();

  return (
    <>
      <LargeTitle title="New split" back="/splits" backLabel="Splits" />
      <SplitForm
        submitLabel="Create split"
        onSubmit={async (input) => {
          await createSplit.mutateAsync(input);
          router.push("/splits");
        }}
      />
    </>
  );
}
