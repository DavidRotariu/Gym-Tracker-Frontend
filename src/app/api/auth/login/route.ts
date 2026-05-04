/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, shouldCookieBeSecure } from "@/lib/auth";
import { getCookieMaxAgeFromJwt } from "@/lib/auth-server";
import { getBackendBaseUrl } from "@/lib/backend-url";

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    const response = await fetch(
      `${getBackendBaseUrl()}/auth/login`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        cache: "no-store",
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { detail: data.detail },
        { status: response.status }
      );
    }

    const accessToken = data?.access_token;
    if (!accessToken || typeof accessToken !== "string") {
      return NextResponse.json(
        { detail: "Login succeeded but token was missing in response" },
        { status: 502 }
      );
    }

    const responseData = NextResponse.json({ ok: true }, { status: 200 });
    responseData.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: accessToken,
      httpOnly: true,
      secure: shouldCookieBeSecure(),
      sameSite: "lax",
      path: "/",
      maxAge: getCookieMaxAgeFromJwt(accessToken),
    });

    return responseData;
  } catch (error: any) {
    return NextResponse.json(
      { detail: "Something went wrong" },
      { status: 500 }
    );
  }
}
