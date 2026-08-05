import { useMutation } from "@tanstack/react-query";
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
