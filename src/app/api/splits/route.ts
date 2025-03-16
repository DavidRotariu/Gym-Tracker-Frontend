/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const token = req.headers.get("Authorization");

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const response = await fetch(`http://127.0.0.1:8000/splits`, {
      method: "GET",
      headers: { Authorization: token },
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch splits" },
      { status: 500 }
    );
  }
}
