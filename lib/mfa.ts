// lib/mfa.ts - Multi-Factor Authentication utilities
import crypto from 'crypto';
import type { MFAMethod, MFAEnrollmentData } from '@/types';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function encodeBase32(buffer: Buffer) {
  let bits = 0;
  let value = 0;
  let output = '';

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

function decodeBase32(secret: string) {
  let bits = 0;
  let value = 0;
  const output: number[] = [];

  for (const character of secret.toUpperCase().replace(/=+$/g, '').replace(/\s/g, '')) {
    const index = BASE32_ALPHABET.indexOf(character);
    if (index < 0) throw new Error('Invalid Base32 secret');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(output);
}

/**
 * Generate a TOTP secret for Google Authenticator
 * Returns the secret and QR code data URL
 */
export function generateTOTPSecret(email: string, appName: string = 'Inventory App'): {
  secret: string;
  qr_code_url: string;
} {
  const secret = encodeBase32(crypto.randomBytes(20));
  
  // Format: otpauth://totp/[email]?secret=[secret]&issuer=[appName]
  const otpauth = `otpauth://totp/${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent(appName)}`;
  
  // QR Code URL (using qr.io service)
  const qr_code_url = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpauth)}`;
  
  return {
    secret,
    qr_code_url,
  };
}

/**
 * Verify a TOTP code
 * Allows for time drift (±30 seconds = ±1 time step)
 */
export function generateTOTPCode(secret: string, timestamp = Date.now()) {
  const counter = BigInt(Math.floor(timestamp / 30_000));
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(counter);
  const digest = crypto.createHmac('sha1', decodeBase32(secret)).update(message).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = digest.readUInt32BE(offset) & 0x7fffffff;
  return (binary % 1_000_000).toString().padStart(6, '0');
}

export function verifyTOTPCode(secret: string, code: string, timeWindow = 1, timestamp = Date.now()): boolean {
  const normalizedCode = code.replace(/\s/g, '');
  if (!/^\d{6}$/.test(normalizedCode)) return false;

  try {
    for (let drift = -timeWindow; drift <= timeWindow; drift += 1) {
      if (generateTOTPCode(secret, timestamp + drift * 30_000) === normalizedCode) return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Generate backup codes for account recovery
 * Returns 10 backup codes
 */
export function generateBackupCodes(count: number = 10): string[] {
  const codes: string[] = [];
  
  for (let i = 0; i < count; i++) {
    // Generate 4-byte random number, convert to 8-character hex code
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    codes.push(`${code.substring(0, 4)}-${code.substring(4)}`);
  }
  
  return codes;
}

/**
 * Verify and consume a backup code
 * Returns true if valid, removes code from list
 */
export function verifyAndConsumBackupCode(
  backupCodes: string[],
  code: string
): { valid: boolean; remaining: string[] } {
  const normalizedInput = code.replace(/\s|-/g, '').toUpperCase();
  
  const index = backupCodes.findIndex(bc => 
    bc.replace(/\s|-/g, '').toUpperCase() === normalizedInput
  );
  
  if (index === -1) {
    return { valid: false, remaining: backupCodes };
  }
  
  // Remove used code
  const remaining = backupCodes.filter((_, i) => i !== index);
  
  return { valid: true, remaining };
}

/**
 * Encrypt sensitive MFA data (backup codes, TOTP secret)
 */
export function encryptMFAData(data: string, key: string): string {
  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
      'aes-256-gcm',
      Buffer.from(key, 'hex').slice(0, 32),
      iv
    );
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // Format: iv:encrypted:authTag
    return `${iv.toString('hex')}:${encrypted}:${authTag.toString('hex')}`;
  } catch (err) {
    console.error('[MFA] Encryption failed:', err);
    throw new Error('Failed to encrypt MFA data');
  }
}

/**
 * Decrypt sensitive MFA data
 */
export function decryptMFAData(encryptedData: string, key: string): string {
  try {
    const [ivHex, encrypted, authTagHex] = encryptedData.split(':');
    
    if (!ivHex || !encrypted || !authTagHex) {
      throw new Error('Invalid encrypted data format');
    }
    
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      Buffer.from(key, 'hex').slice(0, 32),
      iv
    );
    
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (err) {
    console.error('[MFA] Decryption failed:', err);
    throw new Error('Failed to decrypt MFA data');
  }
}

/**
 * Check if MFA enrollment is required based on policy
 */
export function isMFARequired(role: string, enforcementPolicy?: 'mandatory' | 'optional'): boolean {
  if (enforcementPolicy === 'mandatory') {
    return true;
  }
  
  // Owners always encouraged (not mandatory in free tier)
  if (role === 'owner') {
    return false; // Optional but recommended
  }
  
  return false; // Optional for others
}

/**
 * Get MFA method display name
 */
export function getMFAMethodName(method: MFAMethod): string {
  switch (method) {
    case 'totp':
      return 'Authenticator App (TOTP)';
    case 'sms':
      return 'SMS Text Message';
    case 'email':
      return 'Email Code';
    default:
      return 'Unknown';
  }
}

/**
 * Get MFA method description
 */
export function getMFAMethodDescription(method: MFAMethod): string {
  switch (method) {
    case 'totp':
      return 'Use Google Authenticator, Authy, or Microsoft Authenticator app for time-based codes';
    case 'sms':
      return 'Receive 6-digit codes via SMS text message';
    case 'email':
      return 'Receive 6-digit codes via email';
    default:
      return '';
  }
}

/**
 * Format backup codes for display (with line breaks)
 */
export function formatBackupCodesForDisplay(codes: string[]): string {
  return codes.join('\n');
}

/**
 * Parse backup codes from user input
 */
export function parseBackupCodesFromInput(input: string): string[] {
  return input
    .split(/[\s,\n]+/)
    .map(code => code.trim())
    .filter(code => code.length > 0);
}
