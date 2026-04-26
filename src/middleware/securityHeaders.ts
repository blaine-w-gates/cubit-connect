/**
 * Security Headers Middleware
 *
 * Implements M3: Security Headers
 * - Content Security Policy (CSP)
 * - Strict Transport Security (HSTS)
 * - X-Frame-Options
 * - X-Content-Type-Options
 * - Referrer-Policy
 *
 * @module securityHeaders
 * @security
 */

// ============================================================================
// SECURITY HEADER CONFIGURATION
// ============================================================================

export interface SecurityHeadersConfig {
  contentSecurityPolicy?: string;
  strictTransportSecurity?: string;
  xFrameOptions?: string;
  xContentTypeOptions?: string;
  referrerPolicy?: string;
  permissionsPolicy?: string;
}

const DEFAULT_CSP = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co; frame-ancestors 'none'; base-uri 'self'; form-action 'self';";

const DEFAULT_SECURITY_CONFIG: Required<SecurityHeadersConfig> = {
  contentSecurityPolicy: DEFAULT_CSP,
  strictTransportSecurity: 'max-age=31536000; includeSubDomains; preload',
  xFrameOptions: 'DENY',
  xContentTypeOptions: 'nosniff',
  referrerPolicy: 'strict-origin-when-cross-origin',
  permissionsPolicy: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
};

// ============================================================================
// HEADER GENERATION
// ============================================================================

/**
 * Generate security headers object
 */
export function generateSecurityHeaders(
  config: Partial<SecurityHeadersConfig> = {}
): Record<string, string> {
  const finalConfig = { ...DEFAULT_SECURITY_CONFIG, ...config };

  return {
    'Content-Security-Policy': finalConfig.contentSecurityPolicy,
    'Strict-Transport-Security': finalConfig.strictTransportSecurity,
    'X-Frame-Options': finalConfig.xFrameOptions,
    'X-Content-Type-Options': finalConfig.xContentTypeOptions,
    'Referrer-Policy': finalConfig.referrerPolicy,
    'Permissions-Policy': finalConfig.permissionsPolicy,
  };
}

/**
 * Apply security headers to a Next.js response
 */
export function applySecurityHeaders(
  headers: Headers,
  config?: Partial<SecurityHeadersConfig>
): void {
  const securityHeaders = generateSecurityHeaders(config);

  Object.entries(securityHeaders).forEach(([key, value]) => {
    headers.set(key, value);
  });
}

// ============================================================================
// NEXT.JS CONFIGURATION
// ============================================================================

/**
 * Generate headers configuration for next.config.js
 */
export function generateNextJsHeaders() {
  const securityHeaders = generateSecurityHeaders();

  return [
    {
      source: '/:path*',
      headers: Object.entries(securityHeaders).map(([key, value]) => ({
        key,
        value,
      })),
    },
  ];
}

// ============================================================================
// MIDDLEWARE EXPORT
// ============================================================================

export { DEFAULT_SECURITY_CONFIG, DEFAULT_CSP };
