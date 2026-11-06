"use client";

import { AuthWordmark } from "@/components/ui/AuthWordmark";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { useAuth } from "@/hooks/use-auth";
import { ApiRequestError, SESSION_EXPIRED_FLAG } from "@/lib/api/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const DEMO = process.env.NEXT_PUBLIC_USE_MOCKS === "true";

function wasSessionExpired() {
  try {
    return sessionStorage.getItem(SESSION_EXPIRED_FLAG) === "1";
  } catch {
    return false;
  }
}

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  // Demo credentials are a convenience of the mock build only — in a real
  // build they'd fight password autofill and invite signing in to a shared account.
  const [email, setEmail] = useState(DEMO ? "demo@overload.app" : "");
  const [password, setPassword] = useState(DEMO ? "demo1234" : "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Read once on mount; cleared on a successful sign-in below.
  const [expired] = useState(wasSessionExpired);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      try {
        sessionStorage.removeItem(SESSION_EXPIRED_FLAG);
      } catch {
        /* ignore */
      }
      // Back to where an expired session left off (e.g. mid-workout), else
      // "/" — the launch gate (QR + next split), which falls through to
      // /home on its own if it has nothing to show. Same-origin paths only.
      const next = new URLSearchParams(window.location.search).get("next");
      router.replace(next && /^\/(?![/\\])/.test(next) ? next : "/");
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : "Couldn't sign in. Check your connection and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-6">
        <AuthWordmark />
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-large-title text-label">Sign in</h1>
          <p className="text-body text-label-secondary">
            Log every set. Track every overload.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {expired && !error && (
          <p role="status" className="text-caption text-label-secondary">
            Your session expired. Sign in to carry on — anything you changed in the last moment
            wasn&rsquo;t saved, so check it once you&rsquo;re back.
          </p>
        )}
        {error && <p className="text-caption text-red">{error}</p>}
        <Button type="submit" size="lg" block disabled={submitting}>
          {submitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="text-center text-caption text-label-secondary">
        No account?{" "}
        <Link href="/signup" className="text-accent-ink">
          Create one
        </Link>
      </p>
    </div>
  );
}
