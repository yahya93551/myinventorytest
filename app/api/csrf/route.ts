// app/api/csrf/route.ts - CSRF token endpoint
import { generateCSRFToken } from "@/lib/csrf";
import { addCORSHeaders, handleCORSPreflight } from "@/lib/cors";
import { NextRequest, NextResponse } from "next/server";

/**
 * Handle CORS preflight for CSRF endpoint
 */
export async function OPTIONS(request: NextRequest) {
  return handleCORSPreflight(request);
}

/**
 * GET /api/csrf - Get a CSRF token
 * Client should call this before making state-changing requests
 * 
 * Returns: { success: true, token: "..." }
 */
export async function GET(request: NextRequest) {
  try {
    // Generate a new CSRF token
    const token = generateCSRFToken();

    // Create response with token in body and header
    const response = NextResponse.json(
      {
        success: true,
        token,
      },
      { status: 200 }
    );

    // Also set as HTTP-only cookie for double-submit cookie pattern
    response.cookies.set({
      name: 'csrf-token',
      value: token,
      httpOnly: false, // Allow JavaScript to read (needed for header submission)
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 3600, // 1 hour
      path: '/',
    });

    // Add CORS headers
    const corsResponse = addCORSHeaders(response, request);
    
    // Add security headers
    corsResponse.headers.set('X-Content-Type-Options', 'nosniff');
    corsResponse.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

    return corsResponse;
  } catch (error) {
    console.error('[CSRF] Token generation failed:', error);
    const response = NextResponse.json(
      { success: false, error: 'Failed to generate token' },
      { status: 500 }
    );
    return addCORSHeaders(response, request);
  }
}
