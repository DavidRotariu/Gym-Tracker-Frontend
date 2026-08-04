"use client";

import {
  ACCENT_OPTIONS,
  DEFAULT_ACCENT,
  ThemePreference,
  useTheme,
} from "@/components/ThemeProvider";
import { Button } from "@/components/ui/Button";
import { Card, CardList } from "@/components/ui/Card";
import { LargeTitle } from "@/components/ui/LargeTitle";
import { Sheet } from "@/components/ui/Sheet";
import { SET_TYPE_LABEL, SetTypeBadge } from "@/components/ui/SetTypeBadge";
import type { SetType } from "@/types";
import { useAuth } from "@/hooks/use-auth";
import { useQr, useUploadQr } from "@/hooks/use-users";
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
    type: "failure",
    description: "Taken to the point where you can't complete another rep with good form.",
  },
];

export default function ProfilePage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { preference, setPreference, accent, setAccent } = useTheme();
  const { data: qr } = useQr();
  const uploadQr = useUploadQr();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [qrOpen, setQrOpen] = useState(false);

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

      <div className="flex flex-col gap-4">
        {/* Account -------------------------------------------------------- */}
        <Card className="flex items-center gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-pill bg-accent font-display text-large-title text-accent-foreground">
            {initial}
          </div>
          <div className="min-w-0">
            <p className="text-kicker text-label-tertiary uppercase">
              Signed in as
            </p>
            <p className="truncate text-body font-semibold text-label">
              {user?.email}
            </p>
          </div>
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

        {/* Accent color ----------------------------------------------------- */}
        <section className="flex flex-col gap-2">
          <h2 className="px-1 text-kicker text-label-tertiary uppercase">
            Accent color
          </h2>
          <Card>
            <div role="radiogroup" aria-label="Accent color" className="flex flex-wrap gap-3">
              {[DEFAULT_ACCENT, ...ACCENT_OPTIONS].map((hex) => {
                const selected = (accent ?? DEFAULT_ACCENT).toLowerCase() === hex.toLowerCase();
                return (
                  <button
                    key={hex}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={hex}
                    onClick={() => setAccent(hex === DEFAULT_ACCENT ? null : hex)}
                    className="flex size-11 cursor-pointer items-center justify-center rounded-pill active:opacity-70"
                  >
                    <span
                      style={{ backgroundColor: hex }}
                      className={cn(
                        "flex size-8 items-center justify-center rounded-pill transition-transform duration-150",
                        selected && "scale-110 ring-2 ring-offset-2 ring-label ring-offset-background",
                      )}
                    >
                      {selected && (
                        <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                          <path
                            d="M4.5 10.5l3.6 3.6L15.5 6"
                            stroke="white"
                            strokeWidth="2.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </span>
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
                <SetTypeBadge type={type} />
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

        {/* Gym QR --------------------------------------------------------- */}
        <section className="flex flex-col gap-2">
          <h2 className="px-1 text-kicker text-label-tertiary uppercase">
            Gym access
          </h2>
          <CardList>
            <button
              onClick={() => setQrOpen(true)}
              className="flex w-full min-h-[60px] cursor-pointer items-center justify-between gap-3 px-4 py-3 text-left active:bg-fill"
            >
              <div>
                <p className="text-body text-label">QR code</p>
                <p className="text-caption text-label-secondary">
                  {qr?.qr_code_url ? "Tap to show at the door" : "Not uploaded yet"}
                </p>
              </div>
              <Chevron />
            </button>
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

      {/* QR sheet --------------------------------------------------------- */}
      <Sheet open={qrOpen} onClose={() => setQrOpen(false)} title="Gym QR code">
        <div className="flex flex-col items-center gap-4 pt-2 pb-2">
          {qr?.qr_code_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={qr.qr_code_url}
              alt="Your gym QR code"
              className="size-56 rounded-card bg-white object-contain p-3 shadow-sm"
            />
          ) : (
            <div className="flex size-56 items-center justify-center rounded-card border border-dashed border-separator text-center text-caption text-label-tertiary">
              No QR code uploaded yet
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadQr.mutate(file);
            }}
          />
          <Button
            variant="secondary"
            block
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadQr.isPending}
          >
            {uploadQr.isPending
              ? "Uploading…"
              : qr?.qr_code_url
                ? "Replace QR code"
                : "Upload QR code"}
          </Button>
        </div>
      </Sheet>
    </>
  );
}

function Chevron() {
  return (
    <svg
      width="8"
      height="14"
      viewBox="0 0 8 14"
      fill="none"
      className="shrink-0 text-label-tertiary"
      aria-hidden
    >
      <path
        d="M1.5 1 6.5 7l-5 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
