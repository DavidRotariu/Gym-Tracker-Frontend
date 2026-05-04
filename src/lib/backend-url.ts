export function getBackendBaseUrl() {
  const baseUrl = process.env.BACKEND_BASE_URL || process.env.NEXT_PUBLIC_BASE_URL;

  if (!baseUrl) {
    throw new Error("Missing backend base URL. Set BACKEND_BASE_URL or NEXT_PUBLIC_BASE_URL.");
  }

  return baseUrl.replace(/\/+$/, "");
}
