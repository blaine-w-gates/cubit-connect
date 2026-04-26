/**
 * Alerting Module
 *
 * Production alerting integration for Slack and PagerDuty.
 * Connected to circuit breaker and transport fallback events.
 *
 * @module alerting
 * @production
 */

import { audit } from './auditLogger';

// ============================================================================
// TYPES
// ============================================================================

export interface AlertConfig {
  slackWebhookUrl?: string;
  pagerDutyIntegrationKey?: string;
  environment: 'development' | 'staging' | 'production';
  serviceName: string;
}

export interface Alert {
  severity: 'critical' | 'warning' | 'info';
  component: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

let config: AlertConfig = {
  environment: (process.env.NODE_ENV as AlertConfig['environment']) || 'development',
  serviceName: process.env.NEXT_PUBLIC_SERVICE_NAME || 'cubit-connect',
};

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Configure alerting destinations
 */
export function configureAlerting(alertConfig: Partial<AlertConfig>): void {
  config = { ...config, ...alertConfig };
}

/**
 * Send critical alert (circuit breaker open, system down)
 */
export async function sendCriticalAlert(
  component: string,
  message: string,
  details?: Record<string, unknown>
): Promise<void> {
  const alert: Alert = {
    severity: 'critical',
    component,
    message,
    details,
    timestamp: new Date().toISOString(),
  };

  console.error('[ALERT] CRITICAL:', message, details);

  // Audit log
  audit.transport('circuit_breaker_alert', false, { component, message, details });

  // Send to configured destinations
  await Promise.all([sendToSlack(alert), sendToPagerDuty(alert)]);
}

/**
 * Send warning alert (degraded performance, high error rate)
 */
export async function sendWarningAlert(
  component: string,
  message: string,
  details?: Record<string, unknown>
): Promise<void> {
  const alert: Alert = {
    severity: 'warning',
    component,
    message,
    details,
    timestamp: new Date().toISOString(),
  };


  // Audit log
  audit.transport('warning_alert', true, { component, message, details });

  // Only send to Slack for warnings
  await sendToSlack(alert);
}

/**
 * Send info alert (system events, not actionable)
 */
export async function sendInfoAlert(
  component: string,
  message: string,
  details?: Record<string, unknown>
): Promise<void> {
  // In production, info alerts go to logs only (not Slack to reduce noise)
  if (config.environment === 'production') {
    return;
  }

  const alert: Alert = {
    severity: 'info',
    component,
    message,
    details,
    timestamp: new Date().toISOString(),
  };


  // In dev/staging, send to Slack for visibility
  await sendToSlack(alert);
}

// ============================================================================
// SLACK INTEGRATION
// ============================================================================

async function sendToSlack(alert: Alert): Promise<void> {
  if (!config.slackWebhookUrl) {
    return;
  }

  const color = alert.severity === 'critical' ? '#FF0000' : alert.severity === 'warning' ? '#FFA500' : '#36A64F';

  const payload = {
    attachments: [
      {
        color,
        title: `[${alert.severity.toUpperCase()}] ${alert.component}`,
        text: alert.message,
        fields: [
          {
            title: 'Service',
            value: config.serviceName,
            short: true,
          },
          {
            title: 'Environment',
            value: config.environment,
            short: true,
          },
          {
            title: 'Timestamp',
            value: alert.timestamp,
            short: true,
          },
          ...(alert.details
            ? [
                {
                  title: 'Details',
                  value: JSON.stringify(alert.details, null, 2).slice(0, 1000),
                  short: false,
                },
              ]
            : []),
        ],
        footer: 'Cubit Connect Alerting',
        ts: Math.floor(new Date(alert.timestamp).getTime() / 1000),
      },
    ],
  };

  try {
    const response = await fetch(config.slackWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error('[ALERTING] Failed to send Slack alert:', response.status, await response.text());
    } else {
    }
  } catch (error) {
    // INTENTIONALLY SWALLOWING: Alerting is monitoring, not critical path
    // Failed alert doesn't break app functionality, just means no notification sent
    console.error('[ALERTING] Error sending Slack alert:', error);
  }
}

// ============================================================================
// PAGERDUTY INTEGRATION
// ============================================================================

async function sendToPagerDuty(alert: Alert): Promise<void> {
  if (!config.pagerDutyIntegrationKey) {
    return;
  }

  // Only critical alerts go to PagerDuty
  if (alert.severity !== 'critical') {
    return;
  }

  const payload = {
    routing_key: config.pagerDutyIntegrationKey,
    event_action: 'trigger',
    dedup_key: `${config.serviceName}-${alert.component}`,
    payload: {
      summary: `[${config.environment}] ${alert.component}: ${alert.message}`,
      severity: 'critical',
      source: config.serviceName,
      component: alert.component,
      custom_details: alert.details,
    },
  };

  try {
    const response = await fetch('https://events.pagerduty.com/v2/enqueue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error('[ALERTING] Failed to send PagerDuty alert:', response.status);
    } else {
    }
  } catch (error) {
    // INTENTIONALLY SWALLOWING: Alerting is monitoring, not critical path
    // Failed alert doesn't break app functionality, just means no notification sent
    console.error('[ALERTING] Error sending PagerDuty alert:', error);
  }
}

// ============================================================================
// CIRCUIT BREAKER ALERT HANDLER
// ============================================================================

/**
 * Alert handler for circuit breaker events
 */
export function onCircuitBreakerAlert(transport: string, failures: number): void {
  void sendCriticalAlert(
    'circuit-breaker',
    `Circuit breaker OPEN for ${transport} after ${failures} failures`,
    { transport, consecutiveFailures: failures, action: 'Falling back to alternative transport' }
  );
}

/**
 * Alert handler for fallback events
 */
export function onFallbackAlert(from: string, to: string, reason: string): void {
  void sendWarningAlert(
    'transport-fallback',
    `Transport fallback: ${from} → ${to}`,
    { from, to, reason }
  );
}

/**
 * Alert handler for transport recovery
 */
export function onRecoveryAlert(transport: string): void {
  void sendInfoAlert('transport-recovery', `Transport ${transport} recovered`, { transport });
}

// ============================================================================
// DEVTOOLS
// ============================================================================

if (typeof window !== 'undefined') {
  // @ts-expect-error - DevTools
  window.__ALERTING__ = {
    configure: configureAlerting,
    sendCritical: sendCriticalAlert,
    sendWarning: sendWarningAlert,
    sendInfo: sendInfoAlert,
    getConfig: () => config,
  };
}
