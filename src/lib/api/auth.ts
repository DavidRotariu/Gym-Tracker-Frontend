import { apiRequest } from "./client";
import type { User } from "@/types";

export interface AuthResponse {
  access_token: string;
  /** Not currently issued by the deployed API — see use-auth.ts. */
  refresh_token?: string;
  user: User;
}

export function signup(email: string, password: string) {
  return apiRequest<AuthResponse>("/auth/signup", {
    method: "POST",
    body: { email, password },
    auth: false,
  });
}

export function login(email: string, password: string) {
  return apiRequest<AuthResponse>("/auth/login", {
    method: "POST",
    body: { email, password },
    auth: false,
  });
}
