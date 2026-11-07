import { apiRequest, apiRequestBlob, ApiRequestError } from "./client";
import type { Membership, RestDays } from "@/types";

export function uploadQr(file: File) {
  const form = new FormData();
  form.append("file", file);
  return apiRequest<string>("/users/upload-qr", {
    method: "POST",
    body: form,
  });
}

/** Raw QR PNG — turn into an object URL with URL.createObjectURL. */
export function getQrImage() {
  return apiRequestBlob("/users/qr-image");
}

export function uploadProfilePicture(file: File) {
  const form = new FormData();
  form.append("file", file);
  return apiRequest<{ success: boolean; profile_pic: string }>("/users/profile-picture", {
    method: "POST",
    body: form,
  });
}

/** Raw picture bytes, like getQrImage. Resolves to null when the user has no picture set (server returns 404). */
export async function getProfilePicture() {
  try {
    const blob = await apiRequestBlob("/users/profile-picture");
    // An empty body (204) means "no picture" too — an empty blob would render as a broken image.
    return blob.size > 0 ? blob : null;
  } catch (err) {
    if (err instanceof ApiRequestError && err.status === 404) return null;
    throw err;
  }
}

export function deleteProfilePicture() {
  return apiRequest<void>("/users/profile-picture", { method: "DELETE" });
}

export function logMembershipPayment(paidAt: string) {
  return apiRequest<Membership>("/users/membership", {
    method: "POST",
    body: { paid_at: paidAt },
  });
}

/** Resolves to null when no payment has ever been logged (server returns 404,
 *  same convention as GET /users/profile-picture). */
export async function getMembership() {
  try {
    return await apiRequest<Membership>("/users/membership");
  } catch (err) {
    if (err instanceof ApiRequestError && err.status === 404) return null;
    throw err;
  }
}

export function deleteMembership() {
  return apiRequest<void>("/users/membership", { method: "DELETE" });
}

export function getRestDays() {
  return apiRequest<RestDays>("/users/rest-days");
}

export function setRestDate(date: string, rest: boolean) {
  return apiRequest<void>(`/users/rest-days/${date}`, { method: rest ? "PUT" : "DELETE" });
}

export function setRestWeekdays(weekdays: number[]) {
  return apiRequest<RestDays>("/users/rest-weekdays", { method: "PUT", body: { weekdays } });
}
