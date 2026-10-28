/**
 * Client side of the anonymous usage counts. Sends only an event name, a random
 * per-device id and (for games) which subtest finished. Never blocks the UI.
 */
import type { SubtestId } from '../cognitiveProfile/battery';
import type { UsageEvent } from './usageMetrics';

const DEVICE_KEY = 'baseera.anonDevice.v1';

function deviceId(): string | null {
  try {
    let id = window.localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : null;
      if (!id) return null;
      window.localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

export function trackUsage(event: UsageEvent, extra: { subtestId?: SubtestId; discontinued?: boolean } = {}): void {
  if (typeof window === 'undefined' || typeof fetch === 'undefined') return;
  const device = deviceId();
  if (!device) return;
  const body = JSON.stringify({ event, device, ...extra });
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/metrics/event', new Blob([body], { type: 'application/json' }));
      return;
    }
  } catch {
    // fall through to fetch
  }
  fetch('/api/metrics/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
}
