// src/utils/logger.ts
/**
 * Simple telemetry logger.
 *
 * Usage:
 *   import logger from '@/utils/logger';
 *
 *   logger.setUserId('12345');
 *   logger.track('page_view', { page: '/home' });
 *   logger.error(new Error('boom'), { context: 'fetchData' });
 */

type TelemetryPayload = {
  /** Name of the event (e.g. "page_view", "click", "error") */
  event: string;
  /** Timestamp in ISO format */
  timestamp: string;
  /** Arbitrary data attached to the event */
  data?: Record<string, unknown>;
  /** Optional user identifier */
  userId?: string;
};

type LoggerConfig = {
  /** URL of the telemetry collector (e.g. https://telemetry.myapp.com/collect) */
  endpoint: string;
  /** If true, events are also written to console (helpful during dev) */
  debug?: boolean;
  /** Maximum number of retries for a failed request */
  maxRetries?: number;
  /** Milliseconds to wait between retries */
  retryDelayMs?: number;
};

class TelemetryLogger {
  private endpoint: string;
  private debug: boolean;
  private maxRetries: number;
  private retryDelayMs: number;
  private userId?: string;

  constructor(config: LoggerConfig) {
    this.endpoint = config.endpoint;
    this.debug = config.debug ?? false;
    this.maxRetries = config.maxRetries ?? 2;
    this.retryDelayMs = config.retryDelayMs ?? 500;
  }

  /** Set a user identifier that will be attached to every event */
  setUserId(id: string) {
    this.userId = id;
  }

  /** Track a generic event */
  async track(event: string, data?: Record<string, unknown>) {
    await this.send({ event, timestamp: new Date().toISOString(), data, userId: this.userId });
  }

  /** Convenience wrapper for errors */
  async error(err: Error, context?: Record<string, unknown>) {
    const data = {
      message: err.message,
      name: err.name,
      stack: err.stack,
      ...context,
    };
    await this.send({
      event: 'error',
      timestamp: new Date().toISOString(),
      data,
      userId: this.userId,
    });
  }

  /** Low‑level send – handles retries and optional console output */
  private async send(payload: TelemetryPayload) {
    const body = JSON.stringify(payload);
    const headers = { 'Content-Type': 'application/json' };

    if (this.debug) {
      // eslint-disable-next-line no-console
      console.debug('[Telemetry] →', payload);
    }

    let attempt = 0;
    while (attempt <= this.maxRetries) {
      try {
        // `fetch` works in both browsers and recent Node versions.
        // For older Node versions you can replace this with `node-fetch` or `axios`.
        const response = await fetch(this.endpoint, {
          method: 'POST',
          headers,
          body,
        });

        if (!response.ok) {
          throw new Error(`Telemetry server responded ${response.status}`);
        }

        // Success – stop retrying
        return;
      } catch (e) {
        attempt++;
        if (attempt > this.maxRetries) {
          // eslint-disable-next-line no-console
          console.warn('[Telemetry] Failed to send payload after retries:', e);
          return;
        }
        // Wait before the next attempt
        await new Promise((res) => setTimeout(res, this.retryDelayMs));
      }
    }
  }
}

/**
 * Default logger instance.
 *
 * The endpoint can be provided through an environment variable.
 * If none is set, telemetry is a no‑op (but still logs to console when `debug` is true).
 */
const defaultConfig: LoggerConfig = {
  endpoint: process.env.TELEMETRY_ENDPOINT ?? '',
  debug: process.env.NODE_ENV !== 'production',
};

const logger = new TelemetryLogger(defaultConfig);

export default logger;
export type { TelemetryPayload, LoggerConfig };