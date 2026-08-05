"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as authApi from "@/lib/api/auth";
import type { User } from "@/types";

const TOKEN_KEY = "overload_token";
const REFRESH_KEY = "overload_refresh_token";
const USER_KEY = "overload_user";

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

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const scheduleRefresh = useCallback(() => {
    clearTimeout(refreshTimer.current);
    const token = localStorage.getItem(TOKEN_KEY);
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    if (!token || !refreshToken) return;

    const expiresAt = decodeExpiry(token);
    if (!expiresAt) return;

    // Renew a minute before it actually expires, not after — this is what
    // keeps someone logged in indefinitely instead of just until the access
    // token's (short) lifetime runs out. No-ops today: the API doesn't hand
    // out a refresh token yet, so this only activates once it does.
    const delay = Math.max(0, expiresAt - Date.now() - 60_000);
    refreshTimer.current = setTimeout(async () => {
      try {
        const pair = await authApi.refreshTokens(refreshToken);
        localStorage.setItem(TOKEN_KEY, pair.access_token);
        localStorage.setItem(REFRESH_KEY, pair.refresh_token);
        scheduleRefresh();
      } catch {
        // Refresh token is dead too — the next API call's 401 handling
        // (see lib/api/client.ts) will clear the session and redirect.
      }
    }, delay);
  }, []);

  useEffect(() => {
    setUser(readUser());
    setLoading(false);
    scheduleRefresh();
    return () => clearTimeout(refreshTimer.current);
  }, [scheduleRefresh]);

  const persist = useCallback(
    (res: { access_token: string; refresh_token?: string; user: User }) => {
      localStorage.setItem(TOKEN_KEY, res.access_token);
      if (res.refresh_token) localStorage.setItem(REFRESH_KEY, res.refresh_token);
      localStorage.setItem(USER_KEY, JSON.stringify(res.user));
      setUser(res.user);
      scheduleRefresh();
    },
    [scheduleRefresh],
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
    clearTimeout(refreshTimer.current);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
  }, []);

  return { user, loading, login, signup, logout };
}

export function useRequireAuth() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  return { user, loading };
}
