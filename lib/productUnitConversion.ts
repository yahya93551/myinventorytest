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
    if (!Number.isInteger(baseUnits)) {
      throw new Error(`Converted quantity must convert cleanly into ${normalizedBaseUnit} units.`);
    }

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
