/**
 * Security Headers Middleware Tests
 *
 * Verifies M3: Security Headers implementation
 *
 * @module securityHeaders.test
 * @security
 */

import { describe, it, expect } from 'vitest';
import {
  generateSecurityHeaders,
  applySecurityHeaders,
  DEFAULT_SECURITY_CONFIG,
  DEFAULT_CSP,
} from '@/middleware/securityHeaders';

describe('Security Headers Middleware (M3)', () => {
  describe('generateSecurityHeaders', () => {
    it('should generate all required security headers', () => {
      const headers = generateSecurityHeaders();

      expect(headers['Content-Security-Policy']).toBeDefined();
      expect(headers['Strict-Transport-Security']).toBeDefined();
      expect(headers['X-Frame-Options']).toBeDefined();
      expect(headers['X-Content-Type-Options']).toBeDefined();
      expect(headers['Referrer-Policy']).toBeDefined();
      expect(headers['Permissions-Policy']).toBeDefined();
    });

    it('should have correct CSP directives', () => {
      const headers = generateSecurityHeaders();
      const csp = headers['Content-Security-Policy'];

      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("script-src");
      expect(csp).toContain("style-src");
      expect(csp).toContain("img-src");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("connect-src");
    });

    it('should deny framing with X-Frame-Options', () => {
      const headers = generateSecurityHeaders();
      expect(headers['X-Frame-Options']).toBe('DENY');
    });

    it('should enforce HTTPS with HSTS', () => {
      const headers = generateSecurityHeaders();
      const hsts = headers['Strict-Transport-Security'];

      expect(hsts).toContain('max-age=31536000');
      expect(hsts).toContain('includeSubDomains');
    });

    it('should prevent MIME sniffing', () => {
      const headers = generateSecurityHeaders();
      expect(headers['X-Content-Type-Options']).toBe('nosniff');
    });

    it('should have strict referrer policy', () => {
      const headers = generateSecurityHeaders();
      expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    });

    it('should restrict permissions', () => {
      const headers = generateSecurityHeaders();
      const permissions = headers['Permissions-Policy'];

      expect(permissions).toContain('camera=()');
      expect(permissions).toContain('microphone=()');
    });
  });

  describe('custom configuration', () => {
    it('should allow custom CSP', () => {
      const customCsp = "default-src 'none'; script-src 'self';";
      const headers = generateSecurityHeaders({
        contentSecurityPolicy: customCsp,
      });

      expect(headers['Content-Security-Policy']).toBe(customCsp);
    });

    it('should allow custom HSTS', () => {
      const customHsts = 'max-age=86400';
      const headers = generateSecurityHeaders({
        strictTransportSecurity: customHsts,
      });

      expect(headers['Strict-Transport-Security']).toBe(customHsts);
    });
  });

  describe('applySecurityHeaders', () => {
    it('should apply headers to Headers object', () => {
      const headers = new Headers();
      applySecurityHeaders(headers);

      expect(headers.get('X-Frame-Options')).toBe('DENY');
      expect(headers.get('X-Content-Type-Options')).toBe('nosniff');
    });
  });

  describe('exports', () => {
    it('should export DEFAULT_SECURITY_CONFIG', () => {
      expect(DEFAULT_SECURITY_CONFIG).toBeDefined();
      expect(DEFAULT_SECURITY_CONFIG.xFrameOptions).toBe('DENY');
    });

    it('should export DEFAULT_CSP', () => {
      expect(DEFAULT_CSP).toBeDefined();
      expect(typeof DEFAULT_CSP).toBe('string');
    });
  });
});
