/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { getBackendBaseUrl } from "@/lib/backend-url";

export async function POST(req: Request) {
  try {
    const { name, email, password } = await req.json();

    const response = await fetch(`${getBackendBaseUrl()}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
      cache: "no-store",
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { detail: data?.detail || "Signup failed" },
        { status: response.status },
      );
    }

    return NextResponse.json(data, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { detail: "Something went wrong" },
      { status: 500 },
    );
  }
}
