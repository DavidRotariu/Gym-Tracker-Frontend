"use client";

import { ThemePreference, useTheme } from "@/components/ThemeProvider";
import { Button } from "@/components/ui/Button";
import { Card, CardList } from "@/components/ui/Card";
import { LargeTitle } from "@/components/ui/LargeTitle";
import { SET_TYPE_LABEL, SetTypeDot } from "@/components/ui/SetTypeBadge";
import { TextField } from "@/components/ui/TextField";
import type { SetType } from "@/types";
import { useAuth } from "@/hooks/use-auth";
import {
  useDeleteMembership,
  useDeleteProfilePicture,
  useLogMembershipPayment,
  useMembership,
  useProfilePicture,
  useUploadProfilePicture,
} from "@/hooks/use-users";
import { daysUntil, formatMembershipDate } from "@/lib/format";
import { resetDemoData } from "@/lib/mock/reset";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS === "true";

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "Auto" },
];

const SET_TYPE_DESCRIPTIONS: { type: SetType; description: string }[] = [
  {
    type: "warmup",
    description: "Light, easy reps that prep the muscle — doesn't count toward your working volume.",
  },
  {
    type: "standard",
    description: "A regular working set at your target weight and reps.",
  },
  {
    type: "drop",
    description: "Straight after a working set, drop the weight and keep going with no rest.",
  },
  {
    type: "myorep",
    description: "A short rest-pause burst right after a working set — a few more reps without fully resetting.",
  },
];

export default function ProfilePage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { preference, setPreference } = useTheme();
  const profilePictureUrl = useProfilePicture();
  const uploadPicture = useUploadProfilePicture();
  const deletePicture = useDeleteProfilePicture();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
  const MAX_BYTES = 5 * 1024 * 1024;

  function handlePictureChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) return;
    if (file.size > MAX_BYTES) return;
    uploadPicture.mutate(file);
  }

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  function handleReset() {
    resetDemoData();
    setTimeout(() => window.location.reload(), 400);
  }

  const initial = user?.email?.[0]?.toUpperCase() ?? "?";

  return (
    <>
      <LargeTitle title="Profile" />

      <div className="flex flex-col gap-8">
        {/* Membership ------------------------------------------------------ */}
        <MembershipSection />

        {/* Account -------------------------------------------------------- */}
        <Card className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Change profile picture"
            className="relative flex size-14 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-pill bg-accent font-display text-large-title text-accent-foreground"
          >
            {profilePictureUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={profilePictureUrl}
                alt=""
                className="size-full object-cover"
              />
            ) : (
              initial
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handlePictureChange}
          />
          <div className="min-w-0 flex-1">
            <p className="text-kicker text-label-tertiary uppercase">
              Signed in as
            </p>
            <p className="truncate text-body font-semibold text-label">
              {user?.email}
            </p>
          </div>
          {profilePictureUrl && (
            <button
              type="button"
              onClick={() => deletePicture.mutate()}
              disabled={deletePicture.isPending}
              className="shrink-0 text-caption font-medium text-red active:opacity-60 disabled:opacity-40"
            >
              Remove
            </button>
          )}
        </Card>

        {/* Appearance ----------------------------------------------------- */}
        <section className="flex flex-col gap-2">
          <h2 className="px-1 text-kicker text-label-tertiary uppercase">
            Appearance
          </h2>
          <Card className="flex items-center justify-between gap-3">
            <span className="text-body text-label">Theme</span>
            <div
              role="radiogroup"
              aria-label="Theme"
              className="flex gap-1 rounded-control bg-fill p-1"
            >
              {THEME_OPTIONS.map((option) => {
                const selected = preference === option.value;
                return (
                  <button
                    key={option.value}
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setPreference(option.value)}
                    className={cn(
                      "h-8 cursor-pointer rounded-[0.5rem] px-3 text-caption font-semibold transition-colors",
                      selected
                        ? "bg-background text-label shadow-sm"
                        : "text-label-secondary",
                    )}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </Card>
        </section>

        {/* Set types -------------------------------------------------------- */}
        <section className="flex flex-col gap-2">
          <h2 className="px-1 text-kicker text-label-tertiary uppercase">
            Set types
          </h2>
          <CardList>
            {SET_TYPE_DESCRIPTIONS.map(({ type, description }) => (
              <div
                key={type}
                className="flex min-h-[60px] items-center gap-3 px-4 py-3"
              >
                <SetTypeDot type={type} />
                <div className="min-w-0">
                  <p className="text-body text-label">{SET_TYPE_LABEL[type]}</p>
                  <p className="text-caption text-label-secondary">
                    {description}
                  </p>
                </div>
              </div>
            ))}
          </CardList>
        </section>

        {USE_MOCKS && (
          <section className="flex flex-col gap-2">
            <h2 className="px-1 text-kicker text-label-tertiary uppercase">
              Demo
            </h2>
            <Card className="flex flex-col gap-3">
              <p className="text-caption text-label-secondary">
                This build runs on demo data stored on this device.
              </p>
              <Button variant="secondary" onClick={handleReset}>
                Reset demo data
              </Button>
            </Card>
          </section>
        )}

        <Button
          variant="ghost"
          block
          className="mt-2 text-red"
          onClick={handleLogout}
        >
          Log out
        </Button>
      </div>
    </>
  );
}

function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

/** A 30-day membership, ring progress winds down from a full lap at day 0
 *  to empty at day 30 — days-left readable at a glance, same "one glanceable
 *  object" idea as the rest timer's countdown ring. */
const MEMBERSHIP_DAYS = 30;
const RING_R = 27;
const RING_C = 2 * Math.PI * RING_R;

type MembershipTone = "ok" | "warning" | "expired";

const TONE_STROKE: Record<MembershipTone, string> = {
  ok: "var(--color-green)",
  warning: "var(--color-orange)",
  expired: "var(--color-red)",
};

const TONE_TEXT: Record<MembershipTone, string> = {
  ok: "text-green",
  warning: "text-orange",
  expired: "text-red",
};

/**
 * Payment date is logged by hand (no gym integration) — the backend just
 * stores paid_at and returns expires_at = paid_at + 29 days, a 30-day
 * membership counted inclusively, verified against real gym receipts.
 */
function MembershipSection() {
  const { data: membership, isLoading } = useMembership();
  const logPayment = useLogMembershipPayment();
  const deleteMembership = useDeleteMembership();
  const [paidAt, setPaidAt] = useState(todayInputValue);

  const daysLeft = membership ? daysUntil(membership.expires_at) : null;
  const expired = daysLeft !== null && daysLeft < 0;
  const tone: MembershipTone = expired ? "expired" : daysLeft !== null && daysLeft <= 5 ? "warning" : "ok";
  const progress =
    daysLeft === null ? 0 : Math.min(1, Math.max(0, daysLeft / MEMBERSHIP_DAYS));

  function handleLogPayment() {
    if (!paidAt) return;
    logPayment.mutate(paidAt);
  }

  return (
    <section className="flex flex-col gap-2">
      <h2 className="px-1 text-kicker text-label-tertiary uppercase">
        Membership
      </h2>
      <Card className="flex flex-col gap-5">
        {!isLoading && (
          <div className="flex items-center gap-4">
            {!membership || daysLeft === null ? (
              <>
                <div className="flex size-16 shrink-0 items-center justify-center rounded-pill bg-fill text-label-tertiary">
                  <CalendarIcon />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-body font-semibold text-label">
                    No payment logged
                  </p>
                  <p className="text-caption text-label-secondary">
                    Log today's date below to start tracking.
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="relative flex size-16 shrink-0 items-center justify-center">
                  <svg width="64" height="64" viewBox="0 0 64 64" className="-rotate-90">
                    <circle
                      cx="32"
                      cy="32"
                      r={RING_R}
                      fill="none"
                      stroke="var(--color-fill)"
                      strokeWidth="5"
                    />
                    <circle
                      cx="32"
                      cy="32"
                      r={RING_R}
                      fill="none"
                      stroke={TONE_STROKE[tone]}
                      strokeWidth="5"
                      strokeLinecap="round"
                      strokeDasharray={RING_C}
                      strokeDashoffset={(1 - progress) * RING_C}
                      style={{ transition: "stroke-dashoffset 0.4s ease, stroke 0.2s ease" }}
                    />
                  </svg>
                  <span className="tabular absolute font-stat text-[1.05rem] leading-none text-label">
                    {expired ? "!" : daysLeft}
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  <p className={cn("text-body font-semibold", TONE_TEXT[tone])}>
                    {expired
                      ? `Expired ${Math.abs(daysLeft)} day${Math.abs(daysLeft) === 1 ? "" : "s"} ago`
                      : daysLeft === 0
                        ? "Expires today"
                        : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`}
                  </p>
                  <p className="text-caption text-label-secondary">
                    {expired ? "Was valid until" : "Valid until"}{" "}
                    {formatMembershipDate(membership.expires_at)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => deleteMembership.mutate()}
                  disabled={deleteMembership.isPending}
                  aria-label="Remove logged payment"
                  className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-pill text-label-tertiary active:bg-fill active:text-red disabled:opacity-40"
                >
                  <TrashIcon />
                </button>
              </>
            )}
          </div>
        )}

        <div className={cn("flex flex-col gap-3", membership && "border-t border-separator pt-4")}>
          <div className="flex items-end gap-3">
            <TextField
              label={membership ? "Log a new payment" : "Log a payment"}
              type="date"
              value={paidAt}
              max={todayInputValue()}
              onChange={(e) => setPaidAt(e.target.value)}
              className="flex-1"
            />
            <Button
              size="md"
              onClick={handleLogPayment}
              disabled={logPayment.isPending || !paidAt}
            >
              Log
            </Button>
          </div>
        </div>
      </Card>
    </section>
  );
}

function CalendarIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 20 20" fill="none" aria-hidden>
      <rect x="3" y="4" width="14" height="13" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 8h14M6.5 2.5v3M13.5 2.5v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M4 6h12M8 6V4.5A1.5 1.5 0 0 1 9.5 3h1A1.5 1.5 0 0 1 12 4.5V6m-6.5 0 .6 9.4A2 2 0 0 0 8.1 17h3.8a2 2 0 0 0 2-1.6L14.5 6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
