import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import HomeClient from "./HomeClient";
import { AUTH_COOKIE_NAME } from "@/lib/auth";
import { getBackendBaseUrl } from "@/lib/backend-url";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ scroll?: string }>;
}) {
  const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    redirect("/login");
  }

  let splits: any[] = [];
  let error = "";

  try {
    const response = await fetch(`${getBackendBaseUrl()}/splits`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("Failed to fetch splits");
    }

    splits = await response.json();
  } catch (err: any) {
    error = err.message || "Failed to fetch splits";
  }

  const params = await searchParams;
  return (
    <HomeClient
      initialSplits={splits}
      initialError={error}
      initialShowSplits={params?.scroll === "true"}
    />
  );
}
