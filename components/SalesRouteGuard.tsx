"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useTenantRole } from "@/hooks/useTenantRole";

export default function SalesRouteGuard() {
  const { loading } = useRequireAuth();
  const { data: tenantRoleData, isLoading: roleLoading } = useTenantRole();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !roleLoading && tenantRoleData?.role === "sales") {
      router.replace("/inventory");
    }
  }, [loading, roleLoading, tenantRoleData, router]);

  return null;
}
