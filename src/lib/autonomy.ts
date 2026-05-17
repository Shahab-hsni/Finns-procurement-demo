/**
 * Finn's — Autonomy Model (Phase 6 simplification)
 *
 * Two layers, replacing the older 3-tier global model:
 *
 *   1. Per-entity autonomy ('manual' | 'auto') — set on each PO, SKU,
 *      vendor. The wizard captures this at creation time (Step 1 picker
 *      on New Request). Existing per-entity labor switches on Orders,
 *      Inventory, and Suppliers are the authoritative knobs.
 *
 *   2. Global pause (boolean) — a kill-switch that overrides every
 *      per-entity setting. When `agentsPaused === true`, agents stop
 *      acting platform-wide regardless of any entity flagged as 'auto'.
 *      Set from Activity & Governance → Agents tab. Use case: audit
 *      period, cost pause, vacation handoff. Rare admin action; not
 *      surfaced in the header.
 *
 * What changed from the older Off / Assist / Auto model:
 *   • 'off' migrated to 'manual'  (Off was never really "off everything"
 *      — sensing always ran. The real meaning was "user is driving".)
 *   • 'assist' migrated to 'manual'  (Assist was Manual + always-on
 *      smart features. Smart features are always on now — autocomplete,
 *      ranking, summaries are UX, not agent actions — so Assist
 *      collapses into Manual cleanly.)
 *   • The "no agent activity anywhere" intent of the legacy Off mode
 *      is now the agentsPaused boolean.
 *
 * Atlas — unchanged. Atlas is NEVER gated by either layer.
 *
 * Smart features (autocomplete, category detection, vendor relevance
 * ranking, Atlas data summaries) are ALSO never gated. They are UX,
 * not agent actions.
 *
 * What IS gated by Auto vs Manual on the per-entity layer:
 *   • A-01 / A-02 / etc. taking action without user approval
 *   • Auto-pre-pick of vendors in the wizard
 *   • Auto-execution of POs below the spend cap
 *   • Auto-restock when par breached
 */

import { useEffect, useState } from 'react';

export type AutonomyMode = 'manual' | 'auto';

export const AUTONOMY_LABEL: Record<AutonomyMode, string> = {
  manual: 'Manual',
  auto:   'Auto',
};

export const AUTONOMY_TAGLINE: Record<AutonomyMode, string> = {
  manual: 'You drive every action on this entity. Agents observe + surface insights only.',
  auto:   'Agents act within policy. You review exceptions.',
};

// localStorage keys + custom events
const MODE_KEY      = 'finns-autonomy-mode';
const PAUSE_KEY     = 'finns-agents-paused';
const MODE_EVENT    = 'finns-autonomy-changed';
const PAUSE_EVENT   = 'finns-agents-paused-changed';

// ── Migration ─────────────────────────────────────────────────
// Any value persisted under the old 3-tier scheme ('off' / 'assist')
// reads as the new 'manual'. 'auto' carries through unchanged. This
// keeps users with stale localStorage state alive without forcing a
// reset.
function readModeRaw(): AutonomyMode {
  if (typeof window === 'undefined') return 'auto';
  const raw = window.localStorage.getItem(MODE_KEY);
  if (raw === 'auto') return 'auto';
  // Anything else (manual / off / assist / null / corrupted) maps to manual.
  // 'manual' itself also lands here.
  return raw === 'manual' ? 'manual' : (raw === 'off' || raw === 'assist' ? 'manual' : 'auto');
}

export function getDefaultAutonomyMode(): AutonomyMode {
  return readModeRaw();
}

export function setDefaultAutonomyMode(mode: AutonomyMode): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(MODE_KEY, mode);
  window.dispatchEvent(new CustomEvent<AutonomyMode>(MODE_EVENT, { detail: mode }));
}

/**
 * The DEFAULT autonomy mode applied to newly-created entities (POs
 * via the wizard, SKUs via inventory add, vendors via onboarding).
 * Per-entity overrides take precedence after creation. This returns
 * 'auto' by default — Finn's treats AI as the feature that's on
 * unless flipped to Manual on a specific entity.
 */
export function useAutonomyMode(): AutonomyMode {
  const [mode, setMode] = useState<AutonomyMode>(() => getDefaultAutonomyMode());
  useEffect(() => {
    const handler = (e: Event) => setMode((e as CustomEvent<AutonomyMode>).detail);
    window.addEventListener(MODE_EVENT, handler);
    const storageHandler = (e: StorageEvent) => {
      if (e.key === MODE_KEY) setMode(getDefaultAutonomyMode());
    };
    window.addEventListener('storage', storageHandler);
    return () => {
      window.removeEventListener(MODE_EVENT, handler);
      window.removeEventListener('storage', storageHandler);
    };
  }, []);
  return mode;
}

// ── Global pause (kill switch) ─────────────────────────────────

export function getAgentsPaused(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(PAUSE_KEY) === '1';
}

export function setAgentsPaused(paused: boolean): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(PAUSE_KEY, paused ? '1' : '0');
  window.dispatchEvent(new CustomEvent<boolean>(PAUSE_EVENT, { detail: paused }));
}

export function useAgentsPaused(): boolean {
  const [paused, setPaused] = useState<boolean>(() => getAgentsPaused());
  useEffect(() => {
    const handler = (e: Event) => setPaused((e as CustomEvent<boolean>).detail);
    window.addEventListener(PAUSE_EVENT, handler);
    const storageHandler = (e: StorageEvent) => {
      if (e.key === PAUSE_KEY) setPaused(getAgentsPaused());
    };
    window.addEventListener('storage', storageHandler);
    return () => {
      window.removeEventListener(PAUSE_EVENT, handler);
      window.removeEventListener('storage', storageHandler);
    };
  }, []);
  return paused;
}

// ── Convenience helpers ────────────────────────────────────────

/**
 * Initial labor mode for a freshly-created entity. Driven by the
 * system default (returns the same value as getDefaultAutonomyMode).
 * If the wizard exposes a per-entity picker (as the New Request
 * wizard does on Step 1), pass that value through directly — don't
 * call this helper.
 */
export function defaultLaborMode(): AutonomyMode {
  return getDefaultAutonomyMode();
}

/**
 * Can agents act on this entity right now?
 * True iff (entity mode === 'auto') AND global pause is off.
 * If the global pause is on, agents are frozen even on 'auto' entities.
 */
export function agentsMayAct(entityMode: AutonomyMode, paused?: boolean): boolean {
  const effectivePaused = paused ?? getAgentsPaused();
  if (effectivePaused) return false;
  return entityMode === 'auto';
}

/**
 * Should agents surface recommendations on this entity?
 * Recommendations are insight-only — they never trigger action — so
 * they remain visible on Manual entities. The only thing that hides
 * them is the global pause.
 */
export function agentsMaySuggest(paused?: boolean): boolean {
  const effectivePaused = paused ?? getAgentsPaused();
  return !effectivePaused;
}

// ── Legacy aliases — DO NOT use in new code ────────────────────
// Kept temporarily so the rest of the codebase compiles during the
// Phase 6 migration. Remove these once every call site is updated.
export const getAutonomyMode = getDefaultAutonomyMode;
export const setAutonomyMode = setDefaultAutonomyMode;
