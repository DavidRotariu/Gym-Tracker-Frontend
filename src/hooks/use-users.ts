import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as usersApi from "@/lib/api/users";

export function useQr() {
  return useQuery({ queryKey: ["qr"], queryFn: usersApi.getQr });
}

export function useUploadQr() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => usersApi.uploadQr(file),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["qr"] }),
  });
}
