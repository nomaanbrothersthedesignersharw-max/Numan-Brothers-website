/**
 * Lightweight, zero-dependency client runtime error monitor.
 * Captures uncaught exceptions and unhandled promise rejections, emits structured
 * console diagnostics, and optionally forwards beacons to VITE_ERROR_REPORT_URL
 * (e.g. Axiom, Better Stack, or a Sentry relay) without impacting storefront bundle size.
 */

let installed = false;

function reportClientError(kind: 'error' | 'unhandledrejection', message: string, stack?: string): void {
  const payload = {
    ts: new Date().toISOString(),
    service: 'nomaan-brothers-web',
    kind,
    message: message.slice(0, 500),
    stack: stack ? stack.slice(0, 1500) : undefined,
    route: typeof window !== 'undefined' ? window.location.pathname : '',
  };

  console.error('[nb-monitor]', payload);

  const endpoint = (import.meta.env.VITE_ERROR_REPORT_URL || '').trim();
  if (!endpoint || !/^https:\/\//i.test(endpoint)) return;

  try {
    const body = JSON.stringify(payload);
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      navigator.sendBeacon(endpoint, new Blob([body], { type: 'application/json' }));
    } else if (typeof fetch === 'function') {
      void fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // Never let telemetry throw inside an error handler
  }
}

export function installGlobalErrorMonitoring(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  window.addEventListener('error', (event) => {
    const msg = event.message || (event.error instanceof Error ? event.error.message : 'Unknown error');
    const stack = event.error instanceof Error ? event.error.stack : undefined;
    reportClientError('error', msg, stack);
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const msg = reason instanceof Error ? reason.message : String(reason ?? 'Unhandled rejection');
    const stack = reason instanceof Error ? reason.stack : undefined;
    reportClientError('unhandledrejection', msg, stack);
  });
}
