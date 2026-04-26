/**
 * Next.js Root Middleware
 *
 * Integrates M3 (Security Headers), M4 (CORS), M5 (Rate Limiting)
 * Applies to all routes matching config.matcher
 *
 * @module middleware
 * @security
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { generateSecurityHeaders } from '@/middleware/securityHeaders';
import { corsMiddleware, generateCorsHeaders } from '@/middleware/cors';
import { rateLimitMiddleware } from '@/middleware/rateLimit';

// ============================================================================
// SECURITY MIDDLEWARE CONFIGURATION
// ============================================================================

// Paths that skip rate limiting (public assets)
const PUBLIC_PATHS = [
  '/_next/',
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
  '/static/',
];

// API endpoint types for rate limiting
const API_ENDPOINT_TYPES: Record<string, string> = {
  '/api/health': 'health',
  '/api/auth': 'auth',
  '/api/sync': 'sync',
  '/api/checkpoint': 'sync',
};

// ============================================================================
// MAIN MIDDLEWARE
// ============================================================================

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Check if public path (skip rate limiting)
  const isPublicPath = PUBLIC_PATHS.some((publicPath) =>
    path.startsWith(publicPath)
  );

  // Handle CORS preflight
  const corsResponse = corsMiddleware(request);
  if (corsResponse) {
    // Add security headers to preflight
    const securityHeaders = generateSecurityHeaders();
    Object.entries(securityHeaders).forEach(([key, value]) => {
      corsResponse.headers.set(key, value);
    });
    return corsResponse;
  }

  // Apply rate limiting (except for public paths)
  if (!isPublicPath) {
    // Determine endpoint type for rate limiting
    const endpointType = Object.entries(API_ENDPOINT_TYPES).find(([route]) =>
      path.startsWith(route)
    )?.[1] || 'default';

    const rateLimit = rateLimitMiddleware(request, endpointType);

    if (!rateLimit.allowed && rateLimit.response) {
      // Add security headers to rate limit response
      const securityHeaders = generateSecurityHeaders();
      Object.entries(securityHeaders).forEach(([key, value]) => {
        rateLimit.response!.headers.set(key, value);
      });
      return rateLimit.response;
    }

    // Continue with rate limit headers
    const response = NextResponse.next();

    // Add security headers
    const securityHeaders = generateSecurityHeaders();
    Object.entries(securityHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    // Add CORS headers
    const origin = request.headers.get('origin');
    if (origin) {
      const corsHeaders = generateCorsHeaders(origin);
      Object.entries(corsHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
    }

    // Add rate limit headers
    Object.entries(rateLimit.headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  }

  // For public paths, just add security headers
  const response = NextResponse.next();
  const securityHeaders = generateSecurityHeaders();
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

export const config = {
  matcher: [
    // Apply to all routes except static files
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
