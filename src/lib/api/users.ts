import { apiRequest, apiRequestBlob, ApiRequestError } from "./client";

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
    return await apiRequestBlob("/users/profile-picture");
  } catch (err) {
    if (err instanceof ApiRequestError && err.status === 404) return null;
    throw err;
  }
}

export function deleteProfilePicture() {
  return apiRequest<void>("/users/profile-picture", { method: "DELETE" });
}
