export type ProductUnitConversionInput = {
  stock?: number;
  base_unit?: string | null;
  converted_unit?: string | null;
  conversion_rate?: number | null;
};

export type ConvertedSaleQuantity = {
  quantity: number;
  unitLabel: string;
  originalQuantity: number;
  originalUnit: string;
};

export type QuantityDisplayMode = "base" | "converted" | "mixed";

export function convertSaleQuantityToBaseUnits(
  quantity: number,
  product: ProductUnitConversionInput,
  unitMode: "base" | "converted" = "base"
): ConvertedSaleQuantity {
  const normalizedBaseUnit = product.base_unit?.trim();
  const normalizedConvertedUnit = product.converted_unit?.trim();
  const conversionRate = typeof product.conversion_rate === "number" ? product.conversion_rate : null;

  if (!normalizedBaseUnit || !normalizedConvertedUnit || !conversionRate) {
    return {
      quantity,
      unitLabel: normalizedBaseUnit || "unit",
      originalQuantity: quantity,
      originalUnit: unitMode === "converted" ? normalizedConvertedUnit || "unit" : normalizedBaseUnit || "unit",
    };
  }

  if (unitMode === "converted") {
    const baseUnits = quantity / conversionRate;

    return {
      quantity: baseUnits,
      unitLabel: normalizedBaseUnit,
      originalQuantity: quantity,
      originalUnit: normalizedConvertedUnit,
    };
  }

  return {
    quantity,
    unitLabel: normalizedBaseUnit,
    originalQuantity: quantity,
    originalUnit: normalizedBaseUnit,
  };
}

export function formatQuantityWithUnits(
  quantity: number,
  product: ProductUnitConversionInput,
  displayMode: QuantityDisplayMode = "mixed"
): string {
  const normalizedBaseUnit = product.base_unit?.trim();
  const normalizedConvertedUnit = product.converted_unit?.trim();
  const conversionRate = typeof product.conversion_rate === "number" && Number.isFinite(product.conversion_rate) && product.conversion_rate > 0
    ? product.conversion_rate
    : null;

  if (!normalizedBaseUnit || !normalizedConvertedUnit || !conversionRate) {
    if (normalizedBaseUnit) {
      return `${Number(quantity)} ${normalizedBaseUnit}`;
    }

    if (normalizedConvertedUnit) {
      return `${Number(quantity)} ${normalizedConvertedUnit}`;
    }

    return `${Number(quantity)}`;
  }

  if (displayMode === "converted") {
    return `${Math.round(Math.max(0, quantity) * conversionRate)} ${normalizedConvertedUnit}`;
  }

  if (displayMode === "base") {
    return `${Number(quantity)} ${normalizedBaseUnit}`;
  }

  const sign = quantity < 0 ? -1 : 1;
  const absoluteQuantity = Math.abs(quantity);
  const wholeBaseUnits = Math.floor(absoluteQuantity);
  const remainderConverted = Math.round((absoluteQuantity - wholeBaseUnits) * conversionRate);

  const baseText = wholeBaseUnits > 0 ? `${wholeBaseUnits} ${normalizedBaseUnit}` : null;
  const convertedText = remainderConverted > 0 ? `${remainderConverted} ${normalizedConvertedUnit}` : null;
  const formatted = [baseText, convertedText].filter(Boolean).join(" ") || `0 ${normalizedBaseUnit}`;

  return sign < 0 ? `-${formatted}` : formatted;
}

export function formatNetSoldWithUnits(
  quantity: number,
  product: ProductUnitConversionInput,
  displayMode: QuantityDisplayMode = "mixed"
): string {
  const numericValue = Number.isFinite(Number(quantity)) ? Number(quantity) : 0;
  return formatQuantityWithUnits(Math.max(0, numericValue), product, displayMode);
}
