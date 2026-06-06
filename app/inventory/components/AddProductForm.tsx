//app/inventory/components/AddProductForm.tsx
"use client";

import { useState } from "react";
import { CustomField } from "../../../types";
import { CustomFieldInput } from "@/components/CustomFieldInput";
import { getVisibleSystemFields } from "@/lib/customFields";

type Props = {
  name: string;
  setName: (v: string) => void;
  category: string;
  setCategory: (v: string) => void;
  costPrice: number | "";
  setCostPrice: (v: number | "") => void;
  price: number | "";
  setPrice: (v: number | "") => void;
  stock: number | "";
  setStock: (v: number | "") => void;
  categories: string[];
  loadingCategories?: boolean;
  customFields?: CustomField[];
  customData?: Record<string, any>;
  setCustomData?: (data: Record<string, any>) => void;
  addProductHandler: (imageFile?: File | null) => void;
};

export default function AddProductForm({
  name,
  setName,
  category,
  setCategory,
  costPrice,
  setCostPrice,
  price,
  setPrice,
  stock,
  setStock,
  categories,
  loadingCategories = false,
  customFields = [],
  customData = {},
  setCustomData,
  addProductHandler,
}: Props) {
  const visibleStandardFields =
    getVisibleSystemFields(customFields);

  const handleCustomFieldChange = (
    fieldName: string,
    value: any
  ) => {
    if (!setCustomData) return;

    setCustomData({
      ...customData,
      [fieldName]: value,
    });
  };

  // Shared modern responsive styles
  const inputStyle =
    "w-full rounded-2xl border border-theme bg-theme-input px-4 py-3 text-sm text-theme-primary placeholder:text-theme-secondary shadow-sm transition-all duration-200 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20";

  const labelStyle =
    "block text-sm font-semibold text-theme-primary";

  const fieldWrapper =
    "space-y-2 w-full";

  const renderStandardField = (
    field: CustomField
  ) => {
    switch (field.field_name) {
      case "name":
        return (
          <div
            key={field.id}
            className={fieldWrapper}
          >
            <label className={labelStyle}>
              {field.display_name}
            </label>

            <input
              className={inputStyle}
              placeholder="Product title, e.g. Blue Denim Jacket"
              value={name}
              onChange={(e) =>
                setName(e.target.value)
              }
              required={field.is_required}
            />
          </div>
        );

      case "category":
        return (
          <div
            key={field.id}
            className={fieldWrapper}
          >
            <label className={labelStyle}>
              {field.display_name}
            </label>

            <select
              className={inputStyle}
              value={category || ""}
              onChange={(e) =>
                setCategory(e.target.value)
              }
              disabled={loadingCategories}
              required={field.is_required}
            >
              {loadingCategories ? (
                <option>
                  Loading categories...
                </option>
              ) : categories.length === 0 ? (
                <option value="">
                  No categories
                </option>
              ) : (
                <>
                  <option value="" disabled>
                    Select category
                  </option>

                  {categories.map((c, index) => (
                    <option
                      key={`${c}-${index}`}
                      value={c}
                    >
                      {c}
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>
        );

      case "cost_price":
        return (
          <div
            key={field.id}
            className={fieldWrapper}
          >
            <label className={labelStyle}>
              {field.display_name} ($)
            </label>

            <input
              className={inputStyle}
              type="number"
              min={0}
              step="0.01"
              placeholder="Enter cost price"
              value={costPrice}
              onChange={(e) =>
                setCostPrice(
                  e.target.value === ""
                    ? ""
                    : Number(e.target.value)
                )
              }
              required={field.is_required}
            />
          </div>
        );

      case "price":
        return (
          <div
            key={field.id}
            className={fieldWrapper}
          >
            <label className={labelStyle}>
              {field.display_name} ($)
            </label>

            <input
              className={inputStyle}
              type="number"
              min={0}
              step="0.01"
              placeholder="Enter sale price"
              value={price}
              onChange={(e) =>
                setPrice(
                  e.target.value === ""
                    ? ""
                    : Number(e.target.value)
                )
              }
              required={field.is_required}
            />
          </div>
        );

      case "stock":
        return (
          <div
            key={field.id}
            className={fieldWrapper}
          >
            <label className={labelStyle}>
              {field.display_name}
            </label>

            <input
              className={inputStyle}
              type="number"
              placeholder="Enter stock quantity"
              value={stock}
              onChange={(e) =>
                setStock(
                  e.target.value === ""
                    ? ""
                    : Number(e.target.value)
                )
              }
              required={field.is_required}
            />
          </div>
        );

      default:
        return null;
    }
  };

  // Image file local state (optional)
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setImageFile(f);
    
    // Show preview immediately
    if (f) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(f);
    } else {
      setImagePreview(null);
    }
  };

  return (
    <div className="w-full rounded-3xl border border-theme bg-theme-card p-4 sm:p-6 lg:p-8 shadow-soft">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-3">
        <div className="inline-flex items-center gap-2 rounded-full bg-theme-input px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-theme-secondary shadow-sm">
          <span>New product</span>
        </div>

        <div>
          <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-theme-primary">
            ➕ Add a friendly product entry
          </h3>
          <p className="mt-2 text-sm sm:text-base text-theme-secondary max-w-2xl">
            Use the form below to quickly save inventory details — everything adapts to your theme and keeps the UI clean.
          </p>
        </div>
      </div>

      {/* Form Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
        {visibleStandardFields.map(
          renderStandardField
        )}

        {customFields.some(
          (field) => !field.is_system && field.is_visible
        ) && (
          <div className="col-span-full rounded-3xl border border-theme bg-theme-input p-4 text-theme-secondary">
            <p className="text-sm font-semibold text-theme-primary">
              Add custom product details
            </p>
            <p className="mt-1 text-sm">
              Fill any extra fields that help your team understand this product.
            </p>
          </div>
        )}

        {/* Custom Fields */}
        {customFields
          .filter(
            (field) =>
              !field.is_system &&
              field.is_visible
          )
          .map((field) => (
            <div
              key={field.id}
              className="w-full"
            >
              <CustomFieldInput
                field={field}
                value={
                  customData?.[field.field_name]
                }
                onChange={(value) =>
                  handleCustomFieldChange(
                    field.field_name,
                    value
                  )
                }
                disabled={false}
              />
            </div>
          ))}
      </div>

      {/* Footer */}
      <div className="mt-8 flex flex-col gap-3">
        <label className="block text-sm font-semibold text-theme-primary">Product image (optional)</label>
        <div className="flex items-center gap-4">
          <input type="file" accept="image/*" onChange={handleFileChange} className="flex-1" />
          {imagePreview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imagePreview} alt="preview" className="w-16 h-16 object-cover rounded" />
          )}
        </div>

        <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => addProductHandler(imageFile)}
            className="inline-flex items-center justify-center rounded-2xl bg-theme-accent px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg transition-all duration-200 hover:bg-cyan-400 hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40"
          >
            + Add Product
          </button>
        </div>
      </div>
    </div>
  );
}