import { apiRequest } from "./client";

export function getQr() {
  return apiRequest<{ qr_code_url: string | null }>("/users/get-qr");
}

export function uploadQr(file: File) {
  const form = new FormData();
  form.append("file", file);
  return apiRequest<{ qr_code_url: string }>("/users/upload-qr", {
    method: "POST",
    body: form,
  });
}
