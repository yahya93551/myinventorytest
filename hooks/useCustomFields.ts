"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/apiClient";
import { FEATURE_CUSTOM_FIELDS } from "@/lib/featureFlags";
import { CustomField, BusinessSettings } from "@/types";

export function useCustomFields() {
  return useQuery({
    queryKey: ["custom_fields"],
    queryFn: async () => {
      const standardResponse = await apiGet<CustomField[]>("/api/standard-fields");
      const standardFields = standardResponse.data || [];
      if (!FEATURE_CUSTOM_FIELDS) {
        return standardFields;
      }

      const customResponse = await apiGet<CustomField[]>("/api/custom-fields");
      const customFields = customResponse.data || [];
      return [...standardFields, ...customFields];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useBusinessSettings() {
  return useQuery({
    queryKey: ["business_settings"],
    queryFn: async () => {
      const response = await apiGet<BusinessSettings>("/api/business-settings");
      return response.data || {
        id: "",
        tenant_id: "",
        business_type: "custom",
        description: undefined,
        business_name: null,
        business_address: null,
        business_contact_name: null,
        business_contact_phone: null,
        business_contact_email: null,
        business_website: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as BusinessSettings;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
