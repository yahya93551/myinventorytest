"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPatch } from "@/lib/apiClient";
import { CustomField } from "@/types";

interface StandardFieldManagerProps {
  businessType?: string;
}

export function StandardFieldManager({ businessType }: StandardFieldManagerProps) {
  const queryClient = useQueryClient();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch custom fields
  const customFieldsQuery = useQuery<CustomField[], Error>({
    queryKey: ["standard_fields"],
    queryFn: async () => {
      const response = await apiGet<CustomField[]>("/api/standard-fields");
      return response.data || [];
    },
  });

  const customFields = customFieldsQuery.data ?? [];
  const isLoading = customFieldsQuery.isLoading;
  const systemFields = customFields.filter((field) => field.is_system).sort((a, b) => a.field_order - b.field_order);

  // Update visibility mutation with optimistic UI update
  const updateVisibilityMutation = useMutation({
    mutationFn: async ({ id, is_visible }: { id: string; is_visible: boolean }) => {
      const response = await apiPatch<CustomField>("/api/standard-fields", {
        id,
        updates: { is_visible },
      });
      if (!response.data) {
        throw new Error("Failed to update field visibility");
      }
      return response.data;
    },
    onMutate: async ({ id, is_visible }) => {
      await queryClient.cancelQueries({ queryKey: ["standard_fields"] });
      await queryClient.cancelQueries({ queryKey: ["custom_fields"] });

      const previousStandardFields = queryClient.getQueryData<CustomField[]>(["standard_fields"]);
      const previousCustomFields = queryClient.getQueryData<CustomField[]>(["custom_fields"]);

      if (previousStandardFields) {
        queryClient.setQueryData<CustomField[]>(["standard_fields"], previousStandardFields.map((field) =>
          field.id === id ? { ...field, is_visible } : field
        ));
      }

      if (previousCustomFields) {
        queryClient.setQueryData<CustomField[]>(["custom_fields"], previousCustomFields.map((field) =>
          field.id === id ? { ...field, is_visible } : field
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
    onSuccess: (updatedField) => {
      queryClient.setQueryData<CustomField[]>(["standard_fields"], (fields) => {
        if (!fields) return fields;
        return fields.map((field) => (field.id === updatedField.id ? updatedField : field));
      });
      queryClient.setQueryData<CustomField[]>(["custom_fields"], (fields) => {
        if (!fields) return fields;
        return fields.map((field) => (field.id === updatedField.id ? updatedField : field));
      });
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

  if (systemFields.length === 0) {
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
          <div className="mb-4 rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
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
              {systemFields.map((field) => (
                <tr key={field.id} className="border-t border-theme hover:bg-theme-surface">
                  <td className="p-3 text-theme-primary font-medium">{field.display_name}</td>
                  <td className="p-3 text-theme-secondary">{field.field_name}</td>
                  <td className="p-3 text-theme-secondary">{field.field_type}</td>
                  <td className="p-3 text-center">
                    <label className="inline-flex items-center gap-2 justify-center">
                      <input
                        type="checkbox"
                        checked={field.is_visible}
                        onChange={(e) => updateVisibilityMutation.mutate({ id: field.id, is_visible: e.target.checked })}
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