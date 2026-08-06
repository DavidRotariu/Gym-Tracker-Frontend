"use client";

import { LaunchGate } from "@/components/LaunchGate";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";

export default function RootPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user) return null;

  // Authenticated landing hits the QR/"up next" gate first — it decides
  // itself whether it has anything to show and redirects to /home if not.
  return <LaunchGate />;
}
