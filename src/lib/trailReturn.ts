/**
 * Trail-Return marker — the breadcrumb the Decision Attribution Trail
 * leaves in sessionStorage when the user clicks a cross-page deep-link
 * (Agent in Governance / Decision / AI Activity event).
 *
 * Lifecycle:
 *   1. Orders Decision Trail sets the marker before navigating away.
 *   2. The destination page (Governance / AI Activity) reads the marker
 *      on mount and renders a "← Return to PO-XXXX · Stage N Trail" pill.
 *   3. Clicking the pill calls onNavigate('orders'); the marker stays.
 *   4. NewOrdersPage reads the marker on mount, re-opens the Trail on
 *      the right order with the right stage expanded, and clears it.
 *
 * Expires after 30 minutes so a stale session doesn't auto-trigger.
 */

const KEY = 'buyamia-trail-return';
const TTL_MS = 30 * 60 * 1000;

export interface TrailReturnMarker {
  orderId: string;
  stageIdx: number;
}

export function setTrailReturn(orderId: string, stageIdx: number): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ orderId, stageIdx, savedAt: Date.now() }));
  } catch { /* sessionStorage may be unavailable in some embeds */ }
}

export function getTrailReturn(): TrailReturnMarker | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TrailReturnMarker & { savedAt: number };
    if (typeof parsed.savedAt !== 'number' || Date.now() - parsed.savedAt > TTL_MS) {
      sessionStorage.removeItem(KEY);
      return null;
    }
    return { orderId: parsed.orderId, stageIdx: parsed.stageIdx };
  } catch {
    return null;
  }
}

export function clearTrailReturn(): void {
  if (typeof window === 'undefined') return;
  try { sessionStorage.removeItem(KEY); } catch { /* noop */ }
}
