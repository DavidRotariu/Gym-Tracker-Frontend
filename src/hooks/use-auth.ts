"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import * as authApi from "@/lib/api/auth";
import { refreshAccessToken, SESSION_EXPIRED_EVENT } from "@/lib/api/client";
import type { User } from "@/types";

const TOKEN_KEY = "overload_token";
const REFRESH_KEY = "overload_refresh_token";
const USER_KEY = "overload_user";
/** Survives logout/expiry, so the next sign-in can tell whether it's the same person. */
const LAST_USER_KEY = "overload_last_user";

/** Device-local state that belongs to whoever is signed in (theme and the
 *  mock DB are device-level and stay). Prefix match. */
const USER_SCOPED_KEYS = ["overload_favorites", "overload_rest_timer", "overload_exercise_order_"];

function clearUserScopedStorage() {
  for (const key of Object.keys(localStorage)) {
    if (USER_SCOPED_KEYS.some((prefix) => key.startsWith(prefix))) localStorage.removeItem(key);
  }
  sessionStorage.removeItem("overload_launch_shown");
}

function readUser(): User | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

/** Access-token expiry (ms since epoch) from its `exp` claim, no library. */
function decodeExpiry(token: string): number | null {
  try {
    const payload = token.split(".")[1];
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return typeof json.exp === "number" ? json.exp * 1000 : null;
  } catch {
    return null;
  }
}

// One timer for the whole app, not one per useAuth() instance — several
// instances used to each fire their own refresh with the same token.
let refreshTimer: ReturnType<typeof setTimeout> | undefined;

function scheduleRefresh() {
  clearTimeout(refreshTimer);
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token || !localStorage.getItem(REFRESH_KEY)) return;

  const expiresAt = decodeExpiry(token);
  if (!expiresAt) return;

  // Renew a minute before it actually expires, not after. No-ops today: the
  // API doesn't hand out a refresh token yet, so this only activates once
  // it does. Goes through the client's single-flight refresh, so it can
  // never race a 401-triggered one.
  const delay = Math.max(0, expiresAt - Date.now() - 60_000);
  refreshTimer = setTimeout(async () => {
    if (await refreshAccessToken()) scheduleRefresh();
    // else: the next API call's 401 handling ends the session.
  }, delay);
}

export function useAuth() {
  const qc = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUser(readUser());
    setLoading(false);
    scheduleRefresh();
    const onExpired = () => setUser(null);
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, []);

  const persist = useCallback(
    (res: { access_token: string; refresh_token?: string; user: User }) => {
      // Nothing cached from before this sign-in may be shown to it — the
      // query cache is app-wide and outlives client-side navigation, so a
      // previous account's splits/history/"Resume workout" would otherwise
      // render for this one until it went stale.
      qc.clear();
      if (localStorage.getItem(LAST_USER_KEY) !== res.user.id) clearUserScopedStorage();
      localStorage.setItem(LAST_USER_KEY, res.user.id);
      localStorage.setItem(TOKEN_KEY, res.access_token);
      if (res.refresh_token) localStorage.setItem(REFRESH_KEY, res.refresh_token);
      localStorage.setItem(USER_KEY, JSON.stringify(res.user));
      setUser(res.user);
      scheduleRefresh();
    },
    [qc],
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await authApi.login(email, password);
      persist(res);
      return res.user;
    },
    [persist],
  );

  const signup = useCallback(
    async (email: string, password: string) => {
      const res = await authApi.signup(email, password);
      persist(res);
      return res.user;
    },
    [persist],
  );

  const logout = useCallback(() => {
    clearTimeout(refreshTimer);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
    clearUserScopedStorage();
    qc.clear();
    setUser(null);
  }, [qc]);

  return { user, loading, login, signup, logout };
}

export function useRequireAuth() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      // Keep where they were (e.g. mid-workout when the session expired) so
      // signing back in returns there instead of to the launch gate.
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [loading, user, router, pathname]);

  return { user, loading };
}
