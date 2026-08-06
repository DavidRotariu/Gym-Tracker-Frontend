import { apiRequest, apiRequestBlob } from "./client";

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
  return apiRequest<{ profile_picture_url: string }>("/users/profile-picture", {
    method: "POST",
    body: form,
  });
}

/** Resolves to null when the user has no picture set (server returns 204). */
export async function getProfilePicture() {
  const result = await apiRequest<{ profile_picture_url: string } | undefined>(
    "/users/profile-picture",
  );
  return result ?? null;
}

export function deleteProfilePicture() {
  return apiRequest<void>("/users/profile-picture", { method: "DELETE" });
}
