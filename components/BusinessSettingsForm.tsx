"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/apiClient";
import { BusinessSettings } from "@/types";

const BUSINESS_TYPES = [
  { value: "pharmacy", label: "Pharmacy", description: "Medicines, health products" },
  { value: "ngo", label: "NGO", description: "Non-profit organization" },
  { value: "warehouse", label: "Warehouse", description: "Bulk storage and distribution" },
  { value: "supermarket", label: "Supermarket", description: "Retail grocery and general goods" },
  { value: "retail_shop", label: "Retail Shop", description: "Small retail store" },
  { value: "distributor", label: "Distributor", description: "Wholesale distributor" },
  { value: "custom", label: "Custom", description: "Define your own" },
];

interface BusinessSettingsFormProps {
  onBusinessTypeChange?: (type: string) => void;
}

export function BusinessSettingsForm({ onBusinessTypeChange }: BusinessSettingsFormProps) {
  const [selectedType, setSelectedType] = useState("");
  const [description, setDescription] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [businessContactName, setBusinessContactName] = useState("");
  const [businessContactPhone, setBusinessContactPhone] = useState("");
  const [businessContactEmail, setBusinessContactEmail] = useState("");
  const [businessWebsite, setBusinessWebsite] = useState("");

  const { data: settings, isLoading } = useQuery<BusinessSettings | undefined, Error>({
    queryKey: ["business_settings"],
    queryFn: async () => {
      const response = await apiGet<BusinessSettings>("/api/business-settings");
      return response.data;
    },
  });

  useEffect(() => {
    if (settings) {
      setSelectedType(settings.business_type);
      setDescription(settings.description || "");
      setBusinessName(settings.business_name || "");
      setBusinessAddress(settings.business_address || "");
      setBusinessContactName(settings.business_contact_name || "");
      setBusinessContactPhone(settings.business_contact_phone || "");
      setBusinessContactEmail(settings.business_contact_email || "");
      setBusinessWebsite(settings.business_website || "");
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async (data: {
      business_type: string;
      description?: string;
      business_name?: string;
      business_address?: string;
      business_contact_name?: string;
      business_contact_phone?: string;
      business_contact_email?: string;
      business_website?: string;
    }) => {
      const response = await apiPost<BusinessSettings>("/api/business-settings", data);
      return response.data;
    },
    onSuccess: (data) => {
      if (data && onBusinessTypeChange) {
        onBusinessTypeChange(data.business_type);
      }
    },
  });

  const handleSave = async () => {
    if (!selectedType) {
      alert("Please select a business type");
      return;
    }

    await saveMutation.mutateAsync({
      business_type: selectedType,
      description: description || undefined,
      business_name: businessName || undefined,
      business_address: businessAddress || undefined,
      business_contact_name: businessContactName || undefined,
      business_contact_phone: businessContactPhone || undefined,
      business_contact_email: businessContactEmail || undefined,
      business_website: businessWebsite || undefined,
    });
  };

  if (isLoading) {
    return <div className="text-center text-theme-secondary">Loading business settings...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="border border-theme rounded-lg p-4 bg-theme-card">
        <h3 className="text-lg font-semibold text-theme-primary mb-4">Business Type</h3>
        <p className="text-theme-secondary text-sm mb-6">
          Select your business type. This helps us provide relevant features and customization options.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
          {BUSINESS_TYPES.map((type) => (
            <button
              key={type.value}
              onClick={() => setSelectedType(type.value)}
              className={`p-4 rounded border-2 transition text-left ${
                selectedType === type.value
                  ? "border-blue-500 bg-blue-500/10"
                  : "border-theme bg-theme-input hover:border-cyan-400"
              }`}
            >
              <p className="font-semibold text-theme-primary">{type.label}</p>
              <p className="text-sm text-theme-secondary">{type.description}</p>
            </button>
          ))}
        </div>

        {selectedType === "custom" && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-theme-secondary mb-2">
              Describe Your Business
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell us about your business..."
              className="w-full bg-theme-input border border-theme rounded px-3 py-2 text-theme-primary placeholder-theme-secondary focus:outline-none focus:border-cyan-500 h-20 resize-none"
            />
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-theme-secondary mb-2">Business Name</label>
            <input
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Business name"
              className="w-full rounded-2xl border border-theme bg-theme-input px-4 py-3 text-theme-primary outline-none focus:border-cyan-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-theme-secondary mb-2">Business Address</label>
            <input
              value={businessAddress}
              onChange={(e) => setBusinessAddress(e.target.value)}
              placeholder="Address"
              className="w-full rounded-2xl border border-theme bg-theme-input px-4 py-3 text-theme-primary outline-none focus:border-cyan-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-theme-secondary mb-2">Contact Name</label>
            <input
              value={businessContactName}
              onChange={(e) => setBusinessContactName(e.target.value)}
              placeholder="Contact name"
              className="w-full rounded-2xl border border-theme bg-theme-input px-4 py-3 text-theme-primary outline-none focus:border-cyan-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-theme-secondary mb-2">Contact Phone</label>
            <input
              value={businessContactPhone}
              onChange={(e) => setBusinessContactPhone(e.target.value)}
              placeholder="Phone number"
              className="w-full rounded-2xl border border-theme bg-theme-input px-4 py-3 text-theme-primary outline-none focus:border-cyan-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-theme-secondary mb-2">Contact Email</label>
            <input
              value={businessContactEmail}
              onChange={(e) => setBusinessContactEmail(e.target.value)}
              placeholder="Email"
              className="w-full rounded-2xl border border-theme bg-theme-input px-4 py-3 text-theme-primary outline-none focus:border-cyan-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-theme-secondary mb-2">
              Website <span className="text-xs text-theme-secondary">(optional)</span>
            </label>
            <input
              value={businessWebsite}
              onChange={(e) => setBusinessWebsite(e.target.value)}
              placeholder="Website (optional)"
              className="w-full rounded-2xl border border-theme bg-theme-input px-4 py-3 text-theme-primary outline-none focus:border-cyan-400"
            />
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saveMutation.isPending || !selectedType}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-theme-surface text-white font-medium py-2 rounded transition"
        >
          {saveMutation.isPending ? "Saving..." : "Save Business Settings"}
        </button>

        {saveMutation.isSuccess && (
          <p className="text-green-400 text-sm mt-3">✓ Business type saved successfully!</p>
        )}
      </div>
    </div>
  );
}
