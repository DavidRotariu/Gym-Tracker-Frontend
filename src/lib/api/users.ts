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
