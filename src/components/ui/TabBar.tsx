"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/home", label: "Today", Icon: HomeIcon },
  { href: "/splits", label: "Splits", Icon: SplitsIcon },
  { href: "/history", label: "History", Icon: HistoryIcon },
  { href: "/profile", label: "Profile", Icon: ProfileIcon },
];

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[480px]",
        "rounded-t-sheet bg-chrome shadow-sheet",
        "[backdrop-filter:blur(20px)]",
        "pb-[env(safe-area-inset-bottom)]",
      )}
    >
      {/* Hairline highlight instead of a hard edge — the "lifted glass"
          touch that reads as premium on true black. */}
      <div className="h-px bg-gradient-to-r from-transparent via-label/15 to-transparent" />

      <ul className="flex px-2">
        {TABS.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href} className="flex-1 py-1.5">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className="relative flex min-h-[52px] cursor-pointer flex-col items-center justify-center gap-1"
              >
                {/*
                  A single shared-layout pill slides between tabs instead of
                  popping in fresh each time — the sliding motion is what
                  sells "premium" over a static highlight.
                */}
                {active && (
                  <motion.span
                    layoutId="tab-active-pill"
                    className="absolute inset-x-1 inset-y-0 rounded-control bg-fill"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                <motion.span
                  animate={{ scale: active ? 1.08 : 1, y: active ? -1 : 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 24 }}
                  className={cn(
                    "relative",
                    active ? "text-label" : "text-label-secondary",
                  )}
                >
                  <Icon active={active} />
                </motion.span>
                <span
                  className={cn(
                    "relative text-tab font-semibold",
                    active ? "text-label" : "font-medium text-label-secondary",
                  )}
                >
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

interface IconProps {
  active: boolean;
}

function HomeIcon({ active }: IconProps) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3.6 10.9 12 4l8.4 6.9V19a1.4 1.4 0 0 1-1.4 1.4H5a1.4 1.4 0 0 1-1.4-1.4z"
        fill={active ? "currentColor" : "none"}
        fillOpacity={active ? 0.22 : 0}
        stroke="currentColor"
        strokeWidth={active ? 2.1 : 1.7}
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SplitsIcon({ active }: IconProps) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="3.5"
        y="4.5"
        width="17"
        height="5"
        rx="1.8"
        fill={active ? "currentColor" : "none"}
        fillOpacity={active ? 0.22 : 0}
        stroke="currentColor"
        strokeWidth={active ? 2.1 : 1.7}
      />
      <rect
        x="3.5"
        y="14.5"
        width="17"
        height="5"
        rx="1.8"
        fill={active ? "currentColor" : "none"}
        fillOpacity={active ? 0.22 : 0}
        stroke="currentColor"
        strokeWidth={active ? 2.1 : 1.7}
      />
    </svg>
  );
}

function HistoryIcon({ active }: IconProps) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle
        cx="12"
        cy="12"
        r="8.2"
        fill={active ? "currentColor" : "none"}
        fillOpacity={active ? 0.22 : 0}
        stroke="currentColor"
        strokeWidth={active ? 2.1 : 1.7}
      />
      <path
        d="M12 7.4V12l3.2 2"
        stroke="currentColor"
        strokeWidth={active ? 2.3 : 1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ProfileIcon({ active }: IconProps) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle
        cx="12"
        cy="8.5"
        r="3.7"
        fill={active ? "currentColor" : "none"}
        fillOpacity={active ? 0.22 : 0}
        stroke="currentColor"
        strokeWidth={active ? 2.1 : 1.7}
      />
      <path
        d="M4.8 20c1.4-3.8 4.1-5.6 7.2-5.6s5.8 1.8 7.2 5.6"
        fill={active ? "currentColor" : "none"}
        fillOpacity={active ? 0.22 : 0}
        stroke="currentColor"
        strokeWidth={active ? 2.1 : 1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
