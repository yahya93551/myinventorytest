//types/index.ts
import { z } from 'zod';

// Validation schemas
export const ProductSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  category: z.string().min(1, 'Category is required'),
  price: z.number().positive('Price must be positive').max(999999, 'Price too high'),
  stock: z.number().int().min(0, 'Stock cannot be negative'),
  user_id: z.string().uuid().optional(),
});

export const SaleSchema = z.object({
  id: z.string().uuid(),
  productId: z.string().uuid(),
  productName: z.string().min(1),
  quantity: z.number().int().positive('Quantity must be positive'),
  total: z.number().positive('Total must be positive'),
  date: z.string().datetime(),
});

export const CategorySchema = z.string().min(1, 'Category name required').max(50, 'Category name too long');

// Types inferred from schemas
export type Product = z.infer<typeof ProductSchema>;
export type Sale = z.infer<typeof SaleSchema>;
export type Category = z.infer<typeof CategorySchema>;

// Form types (for partial updates)
export type ProductForm = Omit<Product, 'id'>;
export type SaleForm = Omit<Sale, 'id' | 'date'>;
export type BulkSaleItem = {
  productId: string;
  quantity: number;
};

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// UI State types
export interface LoadingState {
  isLoading: boolean;
  error: string | null;
}

export interface InventoryState {
  products: Product[];
  categories: Category[];
  sales: Sale[];
  loading: LoadingState;
}
