"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPatch } from "@/lib/apiClient";
import { FEATURE_CUSTOM_FIELDS } from "@/lib/featureFlags";
import { CustomField } from "@/types";

interface StandardFieldManagerProps {
  businessType?: string;
}

export function StandardFieldManager({ businessType }: StandardFieldManagerProps) {
  const queryClient = useQueryClient();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch standard fields for the tenant. This is needed even when the custom-fields feature
  // is disabled so visibility state can still be persisted and read from the standard-fields API.
  const standardFieldsQuery = useQuery<CustomField[], Error>({
    queryKey: ["standard_fields"],
    queryFn: async () => {
      const response = await apiGet<CustomField[]>("/api/standard-fields");
      return response.data || [];
    },
    enabled: true,
  });

  const standardFields = standardFieldsQuery.data ?? [];
  const productsQuery = useQuery<any[], Error>({
    queryKey: ["products_sample"],
    queryFn: async () => {
      const resp = await apiGet<{ products: any[]; count: number }>("/api/products?page=1&per_page=10");
      return resp.data?.products || [];
    },
    enabled: !FEATURE_CUSTOM_FIELDS,
  });

  const products = productsQuery.data ?? [];
  const isLoading = standardFieldsQuery.isLoading || productsQuery.isLoading;
  const productsLoading = productsQuery.isLoading;
  const systemFields = standardFields.filter((field) => field.is_system).sort((a, b) => a.field_order - b.field_order);

  // Only show these core standard fields in the settings table, in this order.
  const ALLOWED_STANDARD_FIELD_NAMES = [
    "name",
    "category",
    "cost_price",
    "price",
    "stock",
  ];

  let displayedFields: typeof systemFields = ALLOWED_STANDARD_FIELD_NAMES
    .map((fn) => systemFields.find((f) => f.field_name === fn))
    .filter(Boolean) as typeof systemFields;

  if (!FEATURE_CUSTOM_FIELDS) {
    // derive which allowed fields exist in products data, then merge with persisted
    // standard field visibility state if present.
    const present = new Set<string>();
    for (const p of products) {
      for (const fn of ALLOWED_STANDARD_FIELD_NAMES) {
        if (p && p[fn] !== null && p[fn] !== undefined) present.add(fn);
      }
    }

    const persistedSystemFields = standardFields
      .filter((field) => field.is_system && ALLOWED_STANDARD_FIELD_NAMES.includes(field.field_name));

    displayedFields = ALLOWED_STANDARD_FIELD_NAMES.filter((fn) => present.has(fn)).map((fn, idx) => {
      const persisted = persistedSystemFields.find((field) => field.field_name === fn);
      return {
        id: persisted?.id ?? fn,
        tenant_id: persisted?.tenant_id ?? "",
        field_name: fn,
        display_name:
          persisted?.display_name ??
          (fn === "cost_price" ? "Cost Price" : fn === "price" ? "Sell Price" : fn === "stock" ? "Stock" : fn.charAt(0).toUpperCase() + fn.slice(1)),
        field_type: persisted?.field_type ?? (fn === "stock" ? "number" : fn === "cost_price" || fn === "price" ? "currency" : "text"),
        description: persisted?.description ?? "",
        is_required: persisted?.is_required ?? false,
        is_visible: persisted?.is_visible ?? true,
        is_system: true,
        field_order: persisted?.field_order ?? idx,
        created_by: persisted?.created_by ?? "",
        created_at: persisted?.created_at ?? new Date().toISOString(),
        updated_at: persisted?.updated_at ?? new Date().toISOString(),
      };
    }) as typeof systemFields;
  }

  // Update visibility mutation with optimistic UI update
  const updateVisibilityMutation = useMutation({
    mutationFn: async ({ id, field_name, is_visible }: { id: string; field_name?: string; is_visible: boolean }) => {
      const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(id);

      const payload = isUuid
        ? { id, updates: { is_visible } }
        : { field_name: field_name ?? id, updates: { is_visible } };

      const response = await apiPatch<CustomField>("/api/standard-fields", payload as any);
      if (!response.data) {
        throw new Error("Failed to update field visibility");
      }
      return response.data;
    },
    onMutate: async ({ id, field_name, is_visible }) => {
      await queryClient.cancelQueries({ queryKey: ["standard_fields"] });
      await queryClient.cancelQueries({ queryKey: ["custom_fields"] });

      const previousStandardFields = queryClient.getQueryData<CustomField[]>(["standard_fields"]);
      const previousCustomFields = queryClient.getQueryData<CustomField[]>(["custom_fields"]);

      const matches = (field: CustomField) => field.id === id || (field_name && field.field_name === field_name);

      if (previousStandardFields) {
        queryClient.setQueryData<CustomField[]>(["standard_fields"], previousStandardFields.map((field) =>
          matches(field) ? { ...field, is_visible } : field
        ));
      }

      if (previousCustomFields) {
        queryClient.setQueryData<CustomField[]>(["custom_fields"], previousCustomFields.map((field) =>
          matches(field) ? { ...field, is_visible } : field
        ));
      }

      return { previousStandardFields, previousCustomFields };
    },
    onError: (error: Error, variables, context: any) => {
      setErrorMessage(error.message);
      if (context?.previousStandardFields) {
        queryClient.setQueryData(["standard_fields"], context.previousStandardFields);
      }
      if (context?.previousCustomFields) {
        queryClient.setQueryData(["custom_fields"], context.previousCustomFields);
      }
    },
    onSuccess: async (updatedField) => {
      queryClient.setQueryData<CustomField[]>(["standard_fields"], (fields) => {
        if (!fields) return fields;
        return fields.map((field) => (field.id === updatedField.id || field.field_name === updatedField.field_name ? updatedField : field));
      });
      queryClient.setQueryData<CustomField[]>(["custom_fields"], (fields) => {
        if (!fields) return fields;
        return fields.map((field) => (field.id === updatedField.id || field.field_name === updatedField.field_name ? updatedField : field));
      });

      // Ensure any components using `useCustomFields` or `standard_fields` refetch
      await queryClient.invalidateQueries({ queryKey: ["custom_fields"] });
      await queryClient.invalidateQueries({ queryKey: ["standard_fields"] });

      setErrorMessage(null);
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 text-center">
        <p className="text-slate-400 mb-2">Loading standard fields...</p>
        <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-600 border-t-cyan-500"></div>
      </div>
    );
  }

  if (displayedFields.length === 0 && !productsLoading) {
    return (
      <div className="p-6 rounded-lg border border-yellow-500/30 bg-yellow-500/10">
        <p className="text-yellow-100">No standard fields found.</p>
        <p className="text-sm text-yellow-100/70 mt-2">This may indicate the fields haven't been initialized yet. Try refreshing the page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-theme bg-theme-card p-4">
        <h4 className="text-sm font-semibold uppercase tracking-[0.12em] text-theme-secondary mb-3">
          Standard Product Fields
        </h4>

        <p className="text-theme-secondary text-sm mb-4">
          Toggle standard fields on or off for inventory use. All standard fields can now be controlled freely.
        </p>

        {errorMessage ? (
          <div className="mb-4 rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-800">
            {errorMessage}
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-theme-surface">
              <tr>
                <th className="p-3 text-left text-theme-secondary">Display Name</th>
                <th className="p-3 text-left text-theme-secondary">Field Name</th>
                <th className="p-3 text-left text-theme-secondary">Type</th>
                <th className="p-3 text-center text-theme-secondary">Use</th>
                <th className="p-3 text-center text-theme-secondary">Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayedFields.map((field) => (
                <tr key={field.id} className="border-t border-theme hover:bg-theme-surface">
                  <td className="p-3 text-theme-primary font-medium">{field.display_name}</td>
                  <td className="p-3 text-theme-secondary">{field.field_name}</td>
                  <td className="p-3 text-theme-secondary">{field.field_type}</td>
                  <td className="p-3 text-center">
                    <label className="inline-flex items-center gap-2 justify-center">
                      <input
                        type="checkbox"
                        checked={field.is_visible}
                        onChange={(e) => {
                          updateVisibilityMutation.mutate({ id: field.id, field_name: field.field_name, is_visible: e.target.checked });
                        }}
                        className="w-4 h-4 rounded border border-theme bg-theme-input cursor-pointer"
                      />
                      <span className="text-xs text-theme-secondary">Visible</span>
                    </label>
                  </td>
                  <td className="p-3 text-center text-theme-secondary">Visibility only</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {systemFields.length === 0 && (
          <p className="text-theme-muted text-sm italic mt-4">No standard fields configured yet.</p>
        )}
      </div>
    </div>
  );
}