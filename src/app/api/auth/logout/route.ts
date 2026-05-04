import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, shouldCookieBeSecure } from "@/lib/auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });

  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: shouldCookieBeSecure(),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}
