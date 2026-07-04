"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTenantRole } from "@/hooks/useTenantRole";

export default function SalesRouteGuard() {
  const { data: tenantRoleData, isLoading: roleLoading } = useTenantRole();
  const router = useRouter();

  useEffect(() => {
    if (!roleLoading && tenantRoleData?.role === "sales") {
      router.replace("/inventory");
    }
  }, [roleLoading, tenantRoleData, router]);

  return null;
}
