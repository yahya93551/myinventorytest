import { CustomField } from "@/types";

export const requiredSystemFieldNames: string[] = [];
export const alwaysShowSystemFields: string[] = [];

export const fallbackSystemFields: CustomField[] = [
  {
    id: "name-fallback",
    tenant_id: "",
    field_name: "name",
    display_name: "Product Name",
    field_type: "text",
    description: "Product name",
    is_required: true,
    is_visible: true,
    is_system: true,
    field_order: 0,
    created_by: "system",
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  },
  {
    id: "category-fallback",
    tenant_id: "",
    field_name: "category",
    display_name: "Category",
    field_type: "text",
    description: "Product category",
    is_required: true,
    is_visible: true,
    is_system: true,
    field_order: 1,
    created_by: "system",
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  },
  {
    id: "cost-price-fallback",
    tenant_id: "",
    field_name: "cost_price",
    display_name: "Cost Price",
    field_type: "currency",
    description: "Product cost price",
    is_required: false,
    is_visible: true,
    is_system: true,
    field_order: 2,
    created_by: "system",
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  },
  {
    id: "price-fallback",
    tenant_id: "",
    field_name: "price",
    display_name: "Sell Price",
    field_type: "currency",
    description: "Product price",
    is_required: true,
    is_visible: true,
    is_system: true,
    field_order: 3,
    created_by: "system",
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  },
  {
    id: "stock-fallback",
    tenant_id: "",
    field_name: "stock",
    display_name: "Stock Qty",
    field_type: "number",
    description: "Product stock quantity",
    is_required: false,
    is_visible: true,
    is_system: true,
    field_order: 4,
    created_by: "system",
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  },
];

export function mergeSystemFields(customFields: CustomField[] = []) {
  const systemFields = customFields.filter((field) => field.is_system);
  return [
    ...systemFields,
    ...fallbackSystemFields.filter(
      (fallbackField) =>
        !systemFields.some((field) => field.field_name === fallbackField.field_name)
    ),
  ];
}

export function getVisibleSystemFields(customFields: CustomField[] = []) {
  return mergeSystemFields(customFields)
    .filter((field) => field.is_visible)
    .sort((a, b) => a.field_order - b.field_order);
}

export const allowedStandardFieldNames = [
  "name",
  "category",
  "cost_price",
  "price",
  "stock",
];

export function getVisibleSystemFieldNames(customFields: CustomField[] = []) {
  return getVisibleSystemFields(customFields).map((field) => field.field_name);
}

export function getVisibleStandardFields(customFields: CustomField[] = []) {
  return getVisibleSystemFields(customFields)
    .filter((field) => allowedStandardFieldNames.includes(field.field_name));
}

export function getVisibleTableFields(customFields: CustomField[] = []) {
  const visibleCustomFields = customFields.filter(
    (field) => !field.is_system && field.is_visible
  );

  return [
    ...visibleCustomFields,
    ...mergeSystemFields(customFields),
  ]
    .filter((field) => !field.is_system || field.is_visible)
    .sort((a, b) => a.field_order - b.field_order);
}
