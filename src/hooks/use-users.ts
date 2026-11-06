import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiRequestError } from "@/lib/api/client";
import * as usersApi from "@/lib/api/users";

/**
 * The gym QR, cached. It used to be re-downloaded on every open of the QR
 * sheet (and the URL dropped on close), so at the gym door — poor signal,
 * exactly when it's needed — it showed "No QR code uploaded yet" while
 * loading, or for good if the request failed. Now it's fetched once and
 * kept (it only changes on upload), and "none uploaded" (a 404) is told
 * apart from "couldn't load".
 */
export function useQrImage() {
  const query = useQuery({
    queryKey: ["qr-image"],
    queryFn: async () => {
      try {
        return await usersApi.getQrImage();
      } catch (err) {
        if (err instanceof ApiRequestError && err.status === 404) return null;
        throw err;
      }
    },
    staleTime: Infinity,
    gcTime: Infinity,
  });
  const url = useObjectUrl(query.data);
  return {
    url,
    loading: query.isPending,
    failed: query.isError && !query.data,
    retry: () => query.refetch(),
    retrying: query.isFetching,
  };
}

export function useUploadQr() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => usersApi.uploadQr(file),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["qr-image"] }),
  });
}

// One object URL per blob, created on first use and released when the blob is
// garbage-collected. Cached by blob (not made in an effect) so render stays
// pure and StrictMode's double render can't leak or revoke a URL in use.
const blobUrls = new WeakMap<Blob, string>();
const blobUrlCleanup = new FinalizationRegistry<string>((url) => URL.revokeObjectURL(url));

function useObjectUrl(blob: Blob | null | undefined): string | null {
  if (!blob) return null;
  let url = blobUrls.get(blob);
  if (!url) {
    url = URL.createObjectURL(blob);
    blobUrls.set(blob, url);
    blobUrlCleanup.register(blob, url);
  }
  return url;
}

/** Fetches the profile picture blob and exposes an object URL for <img src>. */
export function useProfilePicture() {
  const query = useQuery({
    queryKey: ["profile-picture"],
    queryFn: () => usersApi.getProfilePicture(),
  });
  return useObjectUrl(query.data);
}

export function useUploadProfilePicture() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => usersApi.uploadProfilePicture(file),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile-picture"] }),
  });
}

export function useDeleteProfilePicture() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => usersApi.deleteProfilePicture(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile-picture"] }),
  });
}

export function useMembership() {
  return useQuery({
    queryKey: ["membership"],
    queryFn: () => usersApi.getMembership(),
  });
}

export function useLogMembershipPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (paidAt: string) => usersApi.logMembershipPayment(paidAt),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["membership"] }),
  });
}

export function useDeleteMembership() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => usersApi.deleteMembership(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["membership"] }),
  });
}
