/**
 * Finn's — Autonomy Mode
 *
 * Three global modes that govern how the OPERATING AGENTS act across
 * the platform.
 *
 *   Atlas is NOT an operating agent and is NEVER gated by this mode.
 *   Atlas reads page context, summarizes data, and answers questions
 *   in chat. It does not generate recommendations or execute actions
 *   on its own.
 *
 *   A-01..A-05 (Sourcing / Restock / Vendor Comms / Spend Watchdog /
 *   Logistics) are the operating agents. Their behaviour is:
 *     • Observing is always on (sensing layer: par checks, ETA
 *       tracking, compliance-doc expiry, vendor SLA dips, etc.).
 *     • Recommending + acting is gated by mode.
 *
 *   off    — Agents observe but don't act. Every action requires you.
 *            Alerts and watch-lists keep rendering. Atlas chat + Atlas
 *            data summaries remain available -- only agent-authored
 *            recommendations + receipts are suppressed.
 *   assist — Agents observe + suggest. You approve every action.
 *            Recommendations surface with "Approve · Defer · Decline"
 *            CTAs instead of auto-execute.
 *   auto   — Agents observe + act within policy. You review exceptions.
 *            Default. Agents auto-restock, auto-route POs, auto-send
 *            vendor confirmations within the spend-cap / vendor-trust /
 *            duplicate-detect guardrails.
 *
 * Per-entity overrides (per-PO Labor Switch, per-SKU labor mode, per-
 * vendor labor mode, per-agent suspend) layer on top of the global
 * mode.
 */

import { useEffect, useState } from 'react';

export type AutonomyMode = 'off' | 'assist' | 'auto';

export const AUTONOMY_LABEL: Record<AutonomyMode, string> = {
  off:    'Off',
  assist: 'Assistant',
  auto:   'Autonomous',
};

export const AUTONOMY_TAGLINE: Record<AutonomyMode, string> = {
  off:    'Agents observe but don\'t act. You handle every action.',
  assist: 'Agents observe + suggest. You approve every action.',
  auto:   'Agents observe + act within policy. You review exceptions.',
};

const STORAGE_KEY = 'finns-autonomy-mode';
const EVENT_NAME  = 'finns-autonomy-changed';

export function getAutonomyMode(): AutonomyMode {
  if (typeof window === 'undefined') return 'auto';
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return (raw === 'off' || raw === 'assist' || raw === 'auto') ? raw : 'auto';
}

export function setAutonomyMode(mode: AutonomyMode): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, mode);
  window.dispatchEvent(new CustomEvent<AutonomyMode>(EVENT_NAME, { detail: mode }));
}

/** Subscribe to mode changes. Returns the current mode. */
export function useAutonomyMode(): AutonomyMode {
  const [mode, setMode] = useState<AutonomyMode>(() => getAutonomyMode());
  useEffect(() => {
    const handler = (e: Event) => setMode((e as CustomEvent<AutonomyMode>).detail);
    window.addEventListener(EVENT_NAME, handler);
    // Also re-read on storage events (multi-tab sync, though Finn's is single-tab in practice).
    const storageHandler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setMode(getAutonomyMode());
    };
    window.addEventListener('storage', storageHandler);
    return () => {
      window.removeEventListener(EVENT_NAME, handler);
      window.removeEventListener('storage', storageHandler);
    };
  }, []);
  return mode;
}

/** Default labor mode for new entities (PO / SKU / Supplier). */
export function defaultLaborMode(mode: AutonomyMode): 'agent' | 'manual' {
  return mode === 'auto' ? 'agent' : 'manual';
}

/** True if agents may take actions autonomously. False in off + assist. */
export function agentsMayAct(mode: AutonomyMode): boolean {
  return mode === 'auto';
}

/** True if agents may surface suggestions / recommendations (always true). */
export function agentsMaySuggest(mode: AutonomyMode): boolean {
  return mode !== 'off' ? true : false;
  // Note: even in 'off', sensing still runs (alerts, watch lists). What's
  // suppressed is agent-authored *recommendations* ("I suggest restocking
  // from PT Bali Seafood"). Raw threshold flags ("Tuna at 1.9 days cover")
  // are sensing, not suggestion — always shown.
}
