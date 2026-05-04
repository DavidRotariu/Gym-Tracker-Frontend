export const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "gym_tracker_access_token";

// Determine if cookies should be secure based on environment
// Set COOKIE_SECURE=false if running on HTTP (e.g., EC2 without HTTPS)
export function shouldCookieBeSecure(): boolean {
  if (process.env.COOKIE_SECURE === "false") {
    return false;
  }
  if (process.env.COOKIE_SECURE === "true") {
    return true;
  }
  return process.env.NODE_ENV === "production";
}
