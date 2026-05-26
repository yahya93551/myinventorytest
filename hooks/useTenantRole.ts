"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/apiClient";

export function useTenantRole() {
  return useQuery({
    queryKey: ["tenant_role"],
    queryFn: async () => {
      const resp = await apiGet<{ role: string }>("/api/tenant-role");
      return resp.data || { role: "owner" };
    },
    staleTime: 1000 * 60 * 5,
  });
}
