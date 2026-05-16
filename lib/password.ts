// lib/password.ts - Password management utilities
import crypto from 'crypto';

/**
 * Validate password strength
 * Requirements:
 * - At least 8 characters
 * - At least 1 uppercase letter
 * - At least 1 lowercase letter
 * - At least 1 number
 * - At least 1 special character
 */
export function validatePassword(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (!password || password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must include uppercase letter (A-Z)');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must include lowercase letter (a-z)');
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push('Password must include number (0-9)');
  }
  
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must include special character (!@#$%^&*, etc.)');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get password strength score (0-5)
 * Used for visual feedback in UI
 */
export function getPasswordStrength(password: string): number {
  let score = 0;
  
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score++;
  
  return Math.min(score, 5);
}

/**
 * Get password strength label
 */
export function getPasswordStrengthLabel(score: number): string {
  switch (score) {
    case 0:
    case 1:
      return 'Weak';
    case 2:
      return 'Fair';
    case 3:
      return 'Good';
    case 4:
      return 'Strong';
    case 5:
      return 'Very Strong';
    default:
      return 'Unknown';
  }
}

/**
 * Generate a secure password reset token
 */
export function generatePasswordResetToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hash a password reset token for storage
 * Use this before storing in database
 */
export function hashResetToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Verify a password reset token
 */
export function verifyResetToken(providedToken: string, hashedToken: string): boolean {
  const hashedProvidedToken = hashResetToken(providedToken);
  return constantTimeCompare(hashedProvidedToken, hashedToken);
}

/**
 * Constant-time string comparison (prevents timing attacks)
 */
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  
  return result === 0;
}

/**
 * Check if password meets security policy
 */
export function checkPasswordPolicy(
  password: string,
  options?: {
    minLength?: number;
    requireUppercase?: boolean;
    requireLowercase?: boolean;
    requireNumbers?: boolean;
    requireSpecialChars?: boolean;
  }
): { passes: boolean; message: string } {
  const opts = {
    minLength: options?.minLength || 8,
    requireUppercase: options?.requireUppercase !== false,
    requireLowercase: options?.requireLowercase !== false,
    requireNumbers: options?.requireNumbers !== false,
    requireSpecialChars: options?.requireSpecialChars !== false,
  };
  
  const errors: string[] = [];
  
  if (password.length < opts.minLength) {
    errors.push(`At least ${opts.minLength} characters required`);
  }
  
  if (opts.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Uppercase letter required');
  }
  
  if (opts.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Lowercase letter required');
  }
  
  if (opts.requireNumbers && !/[0-9]/.test(password)) {
    errors.push('Number required');
  }
  
  if (opts.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Special character required');
  }
  
  if (errors.length > 0) {
    return {
      passes: false,
      message: errors.join(', '),
    };
  }
  
  return {
    passes: true,
    message: 'Password meets requirements',
  };
}

/**
 * Generate a temporary password (for admin-set passwords)
 */
export function generateTemporaryPassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  
  // Ensure at least one of each character type
  password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]; // Uppercase
  password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]; // Lowercase
  password += '0123456789'[Math.floor(Math.random() * 10)]; // Number
  password += '!@#$%^&*'[Math.floor(Math.random() * 8)]; // Special char
  
  // Fill remaining length with random characters
  for (let i = password.length; i < 12; i++) {
    password += chars[Math.floor(Math.random() * chars.length)];
  }
  
  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

/**
 * Check if password is commonly used (basic check)
 */
export function isCommonPassword(password: string): boolean {
  const commonPasswords = [
    'password', '123456', 'qwerty', 'abc123', 'password123',
    '000000', '111111', '123123', 'admin', 'letmein',
  ];
  
  return commonPasswords.includes(password.toLowerCase());
}
