import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import * as usersApi from "@/lib/api/users";

/**
 * Fetches the QR PNG as a blob and exposes an object URL for <img src>.
 * Revokes the previous URL whenever a new one is created or the hook
 * unmounts. `refreshKey` lets callers force a refetch (e.g. after upload).
 */
export function useQrImage(enabled: boolean, refreshKey = 0) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setUrl(null);
      setFailed(false);
      return;
    }
    let objectUrl: string | null = null;
    let cancelled = false;
    setFailed(false);

    usersApi
      .getQrImage()
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [enabled, refreshKey]);

  return { url, failed };
}

export function useUploadQr() {
  return useMutation({ mutationFn: (file: File) => usersApi.uploadQr(file) });
}

/** Fetches the profile picture blob and exposes an object URL for <img src>. */
export function useProfilePicture() {
  const query = useQuery({
    queryKey: ["profile-picture"],
    queryFn: () => usersApi.getProfilePicture(),
  });
  const blob = query.data;

  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob) {
      setUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [blob]);

  return url;
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
