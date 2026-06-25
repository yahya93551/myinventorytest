//types/index.ts
import { z } from 'zod';

// Validation schemas
export const ProductSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  category: z.string().min(1, 'Category is required'),
  cost_price: z.number().nonnegative('Cost price cannot be negative'),
  price: z.number().positive('Price must be positive').max(999999, 'Price too high'),
  stock: z.number().int().min(0, 'Stock cannot be negative'),
  image_url: z.string().optional(),
  user_id: z.string().uuid().optional(),
  custom_data: z.record(z.string(), z.any()).optional(),
});

export const SaleSchema = z.object({
  id: z.string().uuid(),
  productId: z.string().uuid(),
  productName: z.string().min(1),
  quantity: z.number().int().positive('Quantity must be positive'),
  total: z.number().positive('Total must be positive'),
  date: z.string().datetime(),
  order_id: z.string().optional(),
  customer_name: z.string().optional(),
  customer_address: z.string().optional(),
  customer_phone: z.string().optional(),
  paid: z.boolean().optional(),
});

export type SaleMetadata = {
  order_id?: string;
  customer_name?: string;
  customer_address?: string;
  customer_phone?: string;
  paid?: boolean;
};

export const CategorySchema = z.string().min(1, 'Category name required').max(50, 'Category name too long');

// Types inferred from schemas
export type Product = z.infer<typeof ProductSchema> & {
  allocated_quantity?: number;
};
export type Sale = z.infer<typeof SaleSchema>;
export type Category = z.infer<typeof CategorySchema>;

// Form types (for partial updates)
export type ProductForm = Omit<Product, 'id'>;
export type SaleForm = Omit<Sale, 'id' | 'date'>;
export type BulkSaleItem = {
  productId: string;
  quantity: number;
};

export type TenantRole = 'owner' | 'accountant' | 'sales' | 'admin';

export interface TenantMember {
  user_id: string;
  tenant_id: string;
  user_email: string;
  role: TenantRole;
  active: boolean;
  created_at: string;
}

// Subscription Types
export type SubscriptionStatus = 'active' | 'inactive' | 'pending' | 'expired';

export interface Subscription {
  id: string;
  tenant_id: string;
  status: SubscriptionStatus;
  plan?: 'basic' | 'pro' | 'team' | null;
  monthly_fee: number;
  billing_date: string | null;
  next_billing_date: string | null;
  active_until: string | null;
  requested_at: string | null;
  approved_at: string | null;
  approved_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

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

// Custom Fields Types
export type CustomFieldType = 'text' | 'number' | 'date' | 'select' | 'checkbox' | 'textarea' | 'currency';
export type BusinessType = 'pharmacy' | 'ngo' | 'warehouse' | 'supermarket' | 'retail_shop' | 'distributor' | 'custom';

export interface CustomField {
  id: string;
  tenant_id: string;
  field_name: string;
  display_name: string;
  field_type: CustomFieldType;
  is_required: boolean;
  is_visible: boolean;
  is_system?: boolean;
  field_order: number;
  select_options?: string[];
  default_value?: string;
  description?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface BusinessSettings {
  id: string;
  tenant_id: string;
  business_type: BusinessType;
  description?: string;
  business_name?: string | null;
  business_address?: string | null;
  business_contact_name?: string | null;
  business_contact_phone?: string | null;
  business_contact_email?: string | null;
  business_website?: string | null;
  created_at: string;
  updated_at: string;
}

// Extended Product with custom data
export interface ProductWithCustomData extends Product {
  custom_data?: Record<string, any>;
}

// Custom Field Validation Schema
export const CustomFieldSchema = z.object({
  field_name: z.string().min(1).max(50),
  display_name: z.string().min(1).max(100),
  field_type: z.enum(['text', 'number', 'date', 'select', 'checkbox', 'textarea', 'currency']),
  is_required: z.boolean().default(false),
  is_visible: z.boolean().default(true),
  field_order: z.number().int().default(0),
  select_options: z.array(z.string()).optional(),
  default_value: z.string().optional(),
  description: z.string().max(500).optional(),
});

export type CustomFieldForm = z.infer<typeof CustomFieldSchema>;

// ============= PHASE 2: 2FA/MFA TYPES =============

export type MFAMethod = 'totp' | 'sms' | 'email';

export interface MFASettings {
  mfa_enabled: boolean;
  mfa_method?: MFAMethod;
  mfa_verified_at?: string;
  mfa_attempts?: number;
  mfa_last_attempt?: string;
}

export interface MFAEnrollmentData {
  method: MFAMethod;
  secret?: string; // For TOTP
  qr_code?: string; // QR code for TOTP
  backup_codes: string[]; // Backup codes for recovery
}

export interface MFAVerificationRequest {
  code: string; // 6-digit code from authenticator
  method: MFAMethod;
  remember_device?: boolean;
}

export interface UserSession {
  id: string;
  user_id: string;
  session_id: string;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
  last_activity: string;
  expires_at: string;
  is_current?: boolean; // Frontend only
}

// ============= PHASE 2: GDPR/COMPLIANCE TYPES =============

export type DataExportFormat = 'json' | 'csv';
export type DataExportStatus = 'pending' | 'processing' | 'ready' | 'expired' | 'downloaded';

export interface DataExportRequest {
  id: string;
  user_id: string;
  export_token: string;
  export_url?: string;
  status: DataExportStatus;
  data_format: DataExportFormat;
  created_at: string;
  expires_at: string;
  downloaded_at?: string;
}

export type AccountDeletionStatus = 'pending' | 'confirmed' | 'processing' | 'completed';

export interface AccountDeletionRequest {
  id: string;
  user_id: string;
  deletion_token: string;
  status: AccountDeletionStatus;
  requested_at: string;
  confirmed_at?: string;
  completed_at?: string;
  expires_at: string;
}

// ============= PHASE 2: PASSWORD RESET TYPES =============

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetConfirm {
  token: string;
  password: string;
  password_confirm: string;
}

export const PasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must include uppercase letter')
  .regex(/[a-z]/, 'Password must include lowercase letter')
  .regex(/[0-9]/, 'Password must include number')
  .regex(/[^A-Za-z0-9]/, 'Password must include special character');

export const ResetPasswordSchema = z.object({
  password: PasswordSchema,
  password_confirm: z.string(),
}).refine(data => data.password === data.password_confirm, {
  message: 'Passwords do not match',
  path: ['password_confirm'],
});

export type ResetPasswordForm = z.infer<typeof ResetPasswordSchema>;
