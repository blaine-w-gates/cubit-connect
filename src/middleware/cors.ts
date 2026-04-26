/**
 * CORS (Cross-Origin Resource Sharing) Middleware
 *
 * Implements M4: CORS Configuration
 * - Configurable allowed origins
 * - Preflight handling
 * - Credential support
 * - Method restrictions
 *
 * @module cors
 * @security
 */

// ============================================================================
// CORS CONFIGURATION
// ============================================================================

export interface CorsConfig {
  allowedOrigins: string[];
  allowedMethods: string[];
  allowedHeaders: string[];
  allowCredentials: boolean;
  maxAge: number; // Preflight cache duration in seconds
}

const DEFAULT_CORS_CONFIG: CorsConfig = {
  allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || [
    'http://localhost:3000',
    'https://localhost:3000',
  ],
  allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-Client-Id',
    'Accept',
  ],
  allowCredentials: true,
  maxAge: 86400, // 24 hours
};

// ============================================================================
// ORIGIN VALIDATION
// ============================================================================

/**
 * Check if origin is allowed
 */
export function isOriginAllowed(
  origin: string | null,
  allowedOrigins: string[]
): boolean {
  if (!origin) return false;

  // Allow wildcard for development
  if (allowedOrigins.includes('*')) {
    return true;
  }

  // Exact match
  if (allowedOrigins.includes(origin)) {
    return true;
  }

  // Check for subdomain wildcards (e.g., https://*.example.com)
  return allowedOrigins.some((allowed) => {
    if (allowed.includes('*')) {
      const regex = new RegExp(
        '^' + allowed.replace(/\./g, '\\.').replace(/\*/g, '[^.]+') + '$'
      );
      return regex.test(origin);
    }
    return false;
  });
}

// ============================================================================
// HEADER GENERATION
// ============================================================================

/**
 * Generate CORS headers for a request
 */
export function generateCorsHeaders(
  requestOrigin: string | null,
  config: Partial<CorsConfig> = {}
): Record<string, string> {
  const finalConfig = { ...DEFAULT_CORS_CONFIG, ...config };

  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': finalConfig.allowedMethods.join(', '),
    'Access-Control-Allow-Headers': finalConfig.allowedHeaders.join(', '),
    'Access-Control-Max-Age': String(finalConfig.maxAge),
  };

  // Only add origin if allowed
  if (requestOrigin && isOriginAllowed(requestOrigin, finalConfig.allowedOrigins)) {
    headers['Access-Control-Allow-Origin'] = requestOrigin;
  } else if (finalConfig.allowedOrigins.includes('*')) {
    headers['Access-Control-Allow-Origin'] = '*';
  }

  if (finalConfig.allowCredentials) {
    headers['Access-Control-Allow-Credentials'] = 'true';
  }

  return headers;
}

/**
 * Handle preflight OPTIONS request
 */
export function handlePreflightRequest(
  requestOrigin: string | null,
  config?: Partial<CorsConfig>
): Response {
  const headers = new Headers();
  const corsHeaders = generateCorsHeaders(requestOrigin, config);

  Object.entries(corsHeaders).forEach(([key, value]) => {
    headers.set(key, value);
  });

  return new Response(null, {
    status: 204,
    headers,
  });
}

// ============================================================================
// NEXT.JS MIDDLEWARE
// ============================================================================

/**
 * CORS middleware for Next.js
 */
export function corsMiddleware(
  request: Request,
  config?: Partial<CorsConfig>
): Response | null {
  const origin = request.headers.get('origin');

  // Handle preflight
  if (request.method === 'OPTIONS') {
    return handlePreflightRequest(origin, config);
  }

  return null;
}

// ============================================================================
// EXPORTS
// ============================================================================

export { DEFAULT_CORS_CONFIG };
