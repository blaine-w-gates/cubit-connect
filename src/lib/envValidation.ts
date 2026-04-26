/**
 * Environment Variable Validation
 *
 * Validates all required environment variables on application startup.
 * Fails fast with clear error messages if configuration is missing.
 *
 * @module envValidation
 * @production
 */

import { audit } from './auditLogger';

// ============================================================================
// REQUIRED ENVIRONMENT VARIABLES
// ============================================================================

export interface EnvValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  config: {
    supabaseUrl: string | undefined;
    supabaseAnonKey: string | undefined;
    sentryDsn: string | undefined;
    appVersion: string | undefined;
    nodeEnv: string;
  };
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate all required environment variables
 */
export function validateEnv(): EnvValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Optional variables
  const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  const appVersion = process.env.NEXT_PUBLIC_APP_VERSION;
  const nodeEnv = process.env.NODE_ENV || 'development';

  // Validate Supabase URL
  if (!supabaseUrl) {
    errors.push(
      'Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL\n' +
        'Please set this to your Supabase project URL (e.g., https://your-project.supabase.co)'
    );
  } else {
    try {
      const url = new URL(supabaseUrl);
      if (!url.hostname.endsWith('.supabase.co')) {
        warnings.push(
          `NEXT_PUBLIC_SUPABASE_URL (${supabaseUrl}) does not appear to be a valid Supabase URL`
        );
      }
    } catch {
      // INTENTIONALLY VALIDATING: URL parsing failure means invalid URL format
      // Add to errors array for user-facing validation report
      errors.push(`Invalid NEXT_PUBLIC_SUPABASE_URL format: ${supabaseUrl}`);
    }
  }

  // Validate Supabase Anon Key
  if (!supabaseAnonKey) {
    errors.push(
      'Missing required environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY\n' +
        'Please set this to your Supabase anonymous key'
    );
  } else if (supabaseAnonKey.length < 20) {
    warnings.push('NEXT_PUBLIC_SUPABASE_ANON_KEY appears to be too short (should be ~100 chars)');
  }

  // Check for Slack webhook (optional but recommended for production)
  if (!process.env.SLACK_WEBHOOK_URL && nodeEnv === 'production') {
    warnings.push(
      'SLACK_WEBHOOK_URL not configured - alerting will not work in production'
    );
  }

  // Log results
  if (errors.length > 0) {
    console.error('[ENV VALIDATION] Environment validation failed:');
    errors.forEach((err) => console.error(`  - ${err}`));

    audit.transport('env_validation', false, { errors, warnings });

    return {
      valid: false,
      errors,
      warnings,
      config: { supabaseUrl, supabaseAnonKey, sentryDsn, appVersion, nodeEnv },
    };
  }

  if (warnings.length > 0) {
    console.warn('[ENV VALIDATION] Environment validation passed with warnings:');
    warnings.forEach((warn) => console.warn(`  - ${warn}`));
  }


  audit.transport('env_validation', true, { warnings });

  return {
    valid: true,
    errors: [],
    warnings,
    config: { supabaseUrl, supabaseAnonKey, sentryDsn, appVersion, nodeEnv },
  };
}

/**
 * Validate environment and throw if invalid
 * Use this in application startup
 */
export function validateEnvOrThrow(): void {
  const result = validateEnv();

  if (!result.valid) {
    const errorMessage = [
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      'ENVIRONMENT VALIDATION FAILED',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      ...result.errors,
      '',
      'Please check your .env.local file and ensure all required variables are set.',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    ].join('\n');

    throw new Error(errorMessage);
  }
}

/**
 * Check if running in valid environment (for runtime checks)
 */
export function isValidEnv(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

/**
 * Get environment configuration (validated)
 */
export function getEnvConfig(): EnvValidationResult['config'] {
  return {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    sentryDsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    appVersion: process.env.NEXT_PUBLIC_APP_VERSION,
    nodeEnv: process.env.NODE_ENV || 'development',
  };
}

// ============================================================================
// DEVTOOLS
// ============================================================================

if (typeof window !== 'undefined') {
  // @ts-expect-error - DevTools
  window.__ENV_VALIDATION__ = {
    validate: validateEnv,
    isValid: isValidEnv,
    getConfig: getEnvConfig,
  };
}
