/**
 * Finn's — Autonomy Mode
 *
 * Three global modes that govern how agents act across the platform.
 * Atlas (chat copilot) is always on regardless of mode.
 *
 *   off       — A-01..A-05 all suspended. Every action manual. Atlas
 *               can still answer questions but does not surface
 *               recommendations.
 *   assist    — Agents surface suggestions everywhere but never auto-
 *               execute. PO default labor mode flips to 'manual'.
 *   auto      — Agents act within policy rules; human gates only at
 *               policy thresholds. Default.
 *
 * Per-entity overrides (per-PO Labor Switch, per-agent suspend) still
 * apply on top of the global mode.
 */

import { useEffect, useState } from 'react';

export type AutonomyMode = 'off' | 'assist' | 'auto';

export const AUTONOMY_LABEL: Record<AutonomyMode, string> = {
  off:    'Off',
  assist: 'Assistant',
  auto:   'Autonomous',
};

export const AUTONOMY_TAGLINE: Record<AutonomyMode, string> = {
  off:    'A-01..A-05 paused. Atlas chat only.',
  assist: 'Agents suggest. You drive.',
  auto:   'Agents act within policy. You review.',
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
