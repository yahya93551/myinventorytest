// lib/cors.ts - CORS security headers
import { NextResponse, NextRequest } from 'next/server';

/**
 * CORS configuration
 * Restricts which origins can make requests to your API
 */
export const CORS_CONFIG = {
  // Add your allowed origins here
  allowedOrigins: (process.env.ALLOWED_ORIGINS || 'http://localhost:3000')
    .split(',')
    .map(origin => origin.trim()),
  
  // Methods allowed for cross-origin requests
  allowedMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  
  // Headers that can be sent in cross-origin requests
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-CSRF-Token',
    'X-Requested-With',
  ],
  
  // Headers exposed to the browser
  exposedHeaders: [
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
    'X-Response-Time',
  ],
  
  // Whether credentials (cookies, auth headers) are allowed
  credentials: true,
  
  // How long browser can cache preflight requests (seconds)
  maxAge: 86400, // 24 hours
};

/**
 * Add CORS security headers to response
 * Enforces origin validation and restricts capabilities
 */
export function addCORSHeaders(
  response: NextResponse | Response,
  request?: NextRequest | Request
): NextResponse {
  const headers = new Headers(response.headers);
  
  const origin = request?.headers?.get('origin');
  
  // Only add CORS headers if origin is allowed
  if (origin && CORS_CONFIG.allowedOrigins.includes(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Credentials', 'true');
    headers.set(
      'Access-Control-Allow-Methods',
      CORS_CONFIG.allowedMethods.join(', ')
    );
    headers.set(
      'Access-Control-Allow-Headers',
      CORS_CONFIG.allowedHeaders.join(', ')
    );
    headers.set(
      'Access-Control-Expose-Headers',
      CORS_CONFIG.exposedHeaders.join(', ')
    );
    headers.set('Access-Control-Max-Age', CORS_CONFIG.maxAge.toString());
  } else if (origin && !CORS_CONFIG.allowedOrigins.includes(origin)) {
    // Log rejected origins for security monitoring
    console.warn(`[CORS] Rejected request from unauthorized origin: ${origin}`);
  }

  // Additional security headers
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('X-XSS-Protection', '1; mode=block');
  
  return new NextResponse(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Handle CORS preflight requests
 * Called for OPTIONS requests
 */
export function handleCORSPreflight(request: NextRequest): NextResponse {
  const response = new NextResponse(null, { status: 204 });
  return addCORSHeaders(response, request);
}
