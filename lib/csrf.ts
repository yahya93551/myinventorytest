// lib/csrf.ts - CSRF token generation and validation
import { randomBytes } from 'crypto';

/**
 * Generate a secure CSRF token
 * Used to prevent cross-site request forgery attacks
 */
export function generateCSRFToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Validate CSRF token from request headers
 * Token should be passed in X-CSRF-Token header for state-changing requests
 */
export function validateCSRFToken(
  requestToken: string | null,
  sessionToken: string | null
): boolean {
  if (!requestToken || !sessionToken) {
    return false;
  }

  // Constant-time comparison to prevent timing attacks
  return constantTimeCompare(requestToken, sessionToken);
}

/**
 * Constant-time string comparison
 * Prevents timing attacks where attackers could deduce token value
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
 * Extract CSRF token from request headers
 * Checks both X-CSRF-Token header and cookie
 */
export function extractCSRFToken(req: Request): {
  headerToken: string | null;
  cookieToken: string | null;
} {
  const headerToken = req.headers.get('x-csrf-token');
  
  // Extract from cookies if present
  const cookieHeader = req.headers.get('cookie');
  let cookieToken: string | null = null;
  
  if (cookieHeader) {
    const match = cookieHeader.match(/csrf-token=([^;]+)/);
    cookieToken = match ? match[1] : null;
  }

  return { headerToken, cookieToken };
}

/**
 * Check if request method requires CSRF validation
 * GET and HEAD requests are safe and don't need CSRF tokens
 */
export function requiresCSRFValidation(method: string): boolean {
  return !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());
}
