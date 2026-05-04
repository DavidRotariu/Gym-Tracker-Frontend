"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-[660px] flex flex-col items-center justify-center gap-4 p-6">
      <p className="text-red-600 text-lg text-center">Something went wrong while loading home.</p>
      <button onClick={() => reset()} className="bg-black text-white px-4 py-2 rounded-full">
        Try again
      </button>
    </div>
  );
}
