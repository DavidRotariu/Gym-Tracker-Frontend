import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME } from "@/lib/auth";
import { getBackendBaseUrl } from "@/lib/backend-url";

type RouteContext = {
  params: Promise<{
    path: string[];
  }>;
};

async function forwardRequest(request: Request, context: RouteContext) {
  const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const { path } = await context.params;
  const requestUrl = new URL(request.url);
  const queryString = requestUrl.search;
  const backendUrl = `${getBackendBaseUrl()}/${path.join("/")}${queryString}`;

  const contentType = request.headers.get("content-type") || "";
  const headers = new Headers({
    Authorization: `Bearer ${token}`,
  });

  let body: BodyInit | undefined;

  if (request.method !== "GET" && request.method !== "HEAD") {
    if (contentType.includes("multipart/form-data")) {
      body = await request.formData();
    } else {
      if (contentType) {
        headers.set("Content-Type", contentType);
      }
      body = await request.text();
    }
  }

  const backendResponse = await fetch(backendUrl, {
    method: request.method,
    headers,
    body,
    cache: "no-store",
  });

  const responseHeaders = new Headers();
  const responseContentType = backendResponse.headers.get("content-type");

  if (responseContentType) {
    responseHeaders.set("Content-Type", responseContentType);
  }

  const payload = await backendResponse.arrayBuffer();
  return new NextResponse(payload, {
    status: backendResponse.status,
    headers: responseHeaders,
  });
}

export async function GET(request: Request, context: RouteContext) {
  return forwardRequest(request, context);
}

export async function POST(request: Request, context: RouteContext) {
  return forwardRequest(request, context);
}

export async function PUT(request: Request, context: RouteContext) {
  return forwardRequest(request, context);
}

export async function PATCH(request: Request, context: RouteContext) {
  return forwardRequest(request, context);
}

export async function DELETE(request: Request, context: RouteContext) {
  return forwardRequest(request, context);
}
