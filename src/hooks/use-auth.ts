"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { useMounted } from "@/hooks/use-mounted";
import { usePathname, useRouter } from "next/navigation";
import * as authApi from "@/lib/api/auth";
import { showToast } from "@/lib/toast";
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

// The signed-in user lives in localStorage (an external store), read with
// useSyncExternalStore. Everything that changes it calls notifyAuth().
const authListeners = new Set<() => void>();
const notifyAuth = () => authListeners.forEach((l) => l());
function subscribeAuth(onChange: () => void) {
  authListeners.add(onChange);
  window.addEventListener("storage", onChange); // another tab signed in/out
  return () => {
    authListeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}
const readUserRaw = () => localStorage.getItem(USER_KEY);

function parseUser(raw: string | null): User | null {
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
    try {
      if (await refreshAccessToken()) scheduleRefresh();
    } catch {
      // Couldn't reach the server — not a verdict on the session. The next
      // API call's 401 handling will try again (or end it).
    }
  }, delay);
}

export function useAuth() {
  const qc = useQueryClient();
  const raw = useSyncExternalStore(subscribeAuth, readUserRaw, () => null);
  const user = useMemo(() => parseUser(raw), [raw]);
  // Not known until the client has hydrated (localStorage doesn't exist on the server).
  const loading = !useMounted();

  useEffect(() => {
    scheduleRefresh();
    // The API client clears the session on a failed refresh and announces it.
    window.addEventListener(SESSION_EXPIRED_EVENT, notifyAuth);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, notifyAuth);
  }, []);

  // Another tab signed out, or in as someone else: this tab must not carry on
  // showing (or writing as) the old account. localStorage is shared, the query
  // cache is not — so drop it here too. (Sign-in/out in *this* tab clear it
  // themselves, below.)
  const shownId = useRef(user?.id);
  useEffect(() => {
    shownId.current = user?.id;
  }, [user?.id]);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== null && e.key !== USER_KEY && e.key !== TOKEN_KEY) return;
      if (parseUser(readUserRaw())?.id !== shownId.current) qc.clear();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [qc]);

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
      notifyAuth();
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

  /**
   * Signs out. Writes still queued or in flight (a set ticked a second ago on
   * a slow connection) get a moment to reach the server first — clearing the
   * cache and token under them lost them silently: no error, no rollback
   * message, just gone. Gives up after 8 s rather than trap someone signed in.
   */
  const logout = useCallback(async () => {
    const deadline = Date.now() + 8000;
    while (qc.isMutating() > 0 && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 100));
    }
    if (qc.isMutating() > 0) {
      // Still unsent (offline, or the server is stalled) — say so rather than drop it quietly.
      showToast("Signed out before your last changes were saved. Check them when you sign back in.");
    }
    clearTimeout(refreshTimer);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
    clearUserScopedStorage();
    qc.clear();
    notifyAuth();
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
