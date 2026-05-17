/**
 * Finn's — Unified Action Log
 *
 * Single source of truth for every mutating action across the platform.
 * Every approve, restock, vendor message, override, rule create, etc.
 * lands here with an actorType tag (agent / admin / system) so every
 * page's "Recent activity" / "Action Log" surface can read from one
 * canonical store with appropriate filters.
 *
 * This is the foundation for the manual baseline (per REALISM-AUDIT
 * pattern 11) — without a single log of actions, Off-mode users have
 * no audit trail of their own work. Activity & Governance's Activity
 * Feed is the canonical consumer; other pages (Overview, Inventory,
 * Suppliers, Spending) filter the same store for their context.
 *
 * Storage: in-memory array + localStorage backing for persistence
 * across reloads. The store is module-level (not React state) so
 * agent dispatches and timer-based emissions can write without a
 * component being mounted. Components subscribe via useActionLog().
 *
 * Capacity: capped at 200 most recent entries to keep localStorage
 * payload manageable. Older entries silently drop off the tail.
 *
 * Usage:
 *   import { logUserAction, useActionLog } from '../lib/actionLog';
 *
 *   // In a component handler:
 *   logUserAction({
 *     kind: 'po-approve',
 *     entity: { type: 'po', id: 'PO-3041' },
 *     summary: 'Approved PO-3041 · PT Bali Seafood Lestari · Rp 14.2M',
 *     category: 'Seafood',
 *     venue: 'Multi',
 *   });
 *
 *   // In a component that displays the log:
 *   const entries = useActionLog({ actorType: 'admin', limit: 20 });
 */

import { useEffect, useState } from 'react';
import type { FinnsCategory, VenueTag, FinnsAgentId } from './types';

// ── Types ─────────────────────────────────────────────────────

export type ActorType = 'agent' | 'admin' | 'system';

/**
 * Catalog of canonical action kinds. Adding new ones: pick a
 * `<noun>-<verb>` shape (e.g. `sku-adjust`, `vendor-message`).
 * Pages should never invent ad-hoc kinds — extend this union.
 */
export type ActionKind =
  // Orders
  | 'po-create' | 'po-approve' | 'po-decline' | 'po-cancel'
  | 'po-stage-advance' | 'po-stage-revert' | 'po-labor-switch'
  | 'po-message-supplier'
  // Inventory
  | 'sku-adjust' | 'sku-restock-trigger' | 'sku-par-floor-set'
  | 'sku-archive' | 'sku-catalog-add' | 'sku-catalog-edit'
  | 'sku-labor-switch'
  // Suppliers
  | 'vendor-onboard' | 'vendor-message' | 'vendor-broadcast'
  | 'vendor-renegotiate' | 'vendor-labor-switch' | 'vendor-pause' | 'vendor-resume'
  // Sourcing
  | 'rfq-send' | 'rfq-quote-received' | 'rfq-award'
  // Spending
  | 'savings-lock' | 'savings-manual-add' | 'budget-update'
  // Activity & Governance
  | 'rule-create' | 'rule-toggle' | 'rule-edit' | 'rule-delete'
  | 'event-override' | 'event-rollback' | 'event-edit-data-point'
  | 'dispute-approve' | 'dispute-reject' | 'dispute-escalate' | 'dispute-harden-precedent'
  | 'agent-suspend' | 'agent-resume'
  | 'ledger-approve' | 'undo-mode-change'
  // Cross-page
  | 'autonomy-mode-change'
  | 'entity-note-edit';

export type ActionEntityType =
  | 'po' | 'sku' | 'supplier' | 'rule' | 'event'
  | 'dispute' | 'budget' | 'agent' | 'ledger' | 'platform';

export type ActionOutcome = 'success' | 'pending' | 'failed' | 'overridden';

export interface ActionLogEntry {
  /** Auto-generated id: 'act-NNNNNN'. */
  id: string;
  /** ISO timestamp. */
  at: string;
  /** Who took the action. */
  actorType: ActorType;
  /** 'admin' | 'A-01'..'A-05' | 'system'. */
  actorId: string;
  /** Display label: 'You' | 'Sourcing Agent' | 'System'. */
  actorLabel: string;
  /** What kind of action. See ActionKind. */
  kind: ActionKind;
  /** The thing the action acted on (if any). */
  entity?: {
    type: ActionEntityType;
    id: string;
  };
  /** One-line for feed display. Should reference the key actors + values. */
  summary: string;
  /** Optional category for category-filtered views (Spending, etc.). */
  category?: FinnsCategory;
  /** Optional venue for venue-filtered views. 'Multi' for cross-venue actions. */
  venue?: VenueTag | 'Multi';
  /** Outcome. Defaults to 'success' if omitted at log time. */
  outcome: ActionOutcome;
  /** Optional longer text or structured note. */
  details?: string;
  /** Optional structured metadata (amount, prior value, etc.). */
  meta?: Record<string, unknown>;
}

// ── Storage ───────────────────────────────────────────────────

const STORAGE_KEY = 'finns-action-log';
const EVENT_NAME  = 'finns-action-log-changed';
const MAX_ENTRIES = 200;

let store: ActionLogEntry[] = [];
let initialized = false;
let nextIdSeed = 100000;

function loadFromStorage(): ActionLogEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function saveToStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* localStorage may be full or disabled — silently drop */
  }
}

function broadcast(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

function nextId(): string {
  nextIdSeed += 1;
  return `act-${nextIdSeed}`;
}

function init(): void {
  if (initialized) return;
  initialized = true;
  const fromStorage = loadFromStorage();
  if (fromStorage.length > 0) {
    store = fromStorage;
    // Re-sync nextIdSeed to highest seen + 1
    const maxSeed = fromStorage.reduce((max, e) => {
      const m = e.id.match(/^act-(\d+)$/);
      return m ? Math.max(max, parseInt(m[1], 10)) : max;
    }, nextIdSeed);
    nextIdSeed = maxSeed + 1;
  } else {
    // First load — seed with realistic historical entries so the
    // Activity Feed isn't empty on first render.
    store = SEEDED_HISTORY.slice();
    saveToStorage();
  }
}

// ── Public API ────────────────────────────────────────────────

export interface LogActionInput extends Omit<ActionLogEntry, 'id' | 'at' | 'outcome' | 'actorType' | 'actorId' | 'actorLabel'> {
  outcome?: ActionOutcome;
}

/** Append a user (admin) action. Used by every page's handler. */
export function logUserAction(input: LogActionInput): ActionLogEntry {
  return logAction({
    ...input,
    actorType: 'admin',
    actorId: 'admin',
    actorLabel: 'You',
  });
}

/** Append an agent action. Used when A-01..A-05 take autonomous actions. */
export function logAgentAction(agentId: FinnsAgentId, agentLabel: string, input: LogActionInput): ActionLogEntry {
  return logAction({
    ...input,
    actorType: 'agent',
    actorId: agentId,
    actorLabel: agentLabel,
  });
}

/** Append a system event (scheduled trigger, automatic state transition). */
export function logSystemAction(input: LogActionInput): ActionLogEntry {
  return logAction({
    ...input,
    actorType: 'system',
    actorId: 'system',
    actorLabel: 'System',
  });
}

/** Lower-level: append a fully-specified action. Used by the typed helpers above. */
export function logAction(
  input: LogActionInput & { actorType: ActorType; actorId: string; actorLabel: string }
): ActionLogEntry {
  init();
  const entry: ActionLogEntry = {
    id: nextId(),
    at: new Date().toISOString(),
    outcome: 'success',
    ...input,
  };
  // Prepend (newest first); cap at MAX_ENTRIES.
  store = [entry, ...store].slice(0, MAX_ENTRIES);
  saveToStorage();
  broadcast();
  return entry;
}

export interface ActionLogFilter {
  actorType?: ActorType | 'all';
  actorId?: string;
  kind?: ActionKind | ActionKind[];
  entityType?: ActionEntityType;
  entityId?: string;
  category?: FinnsCategory;
  venue?: VenueTag | 'Multi';
  outcome?: ActionOutcome;
  /** ISO date string — only entries at-or-after this timestamp. */
  since?: string;
  /** Hard limit on returned entries. */
  limit?: number;
}

/** Read the log with optional filters. Newest first. */
export function readActionLog(filter?: ActionLogFilter): ActionLogEntry[] {
  init();
  let result = store;
  if (filter) {
    if (filter.actorType && filter.actorType !== 'all') {
      result = result.filter(e => e.actorType === filter.actorType);
    }
    if (filter.actorId) result = result.filter(e => e.actorId === filter.actorId);
    if (filter.kind) {
      const kinds = Array.isArray(filter.kind) ? filter.kind : [filter.kind];
      result = result.filter(e => kinds.includes(e.kind));
    }
    if (filter.entityType) result = result.filter(e => e.entity?.type === filter.entityType);
    if (filter.entityId)   result = result.filter(e => e.entity?.id === filter.entityId);
    if (filter.category)   result = result.filter(e => e.category === filter.category);
    if (filter.venue)      result = result.filter(e => e.venue === filter.venue);
    if (filter.outcome)    result = result.filter(e => e.outcome === filter.outcome);
    if (filter.since)      result = result.filter(e => e.at >= filter.since!);
    if (filter.limit)      result = result.slice(0, filter.limit);
  }
  return result;
}

/** Subscribe to the action log. Returns filtered entries, re-renders on change. */
export function useActionLog(filter?: ActionLogFilter): ActionLogEntry[] {
  const [, setTick] = useState(0);
  useEffect(() => {
    const handler = () => setTick(t => t + 1);
    window.addEventListener(EVENT_NAME, handler);
    return () => window.removeEventListener(EVENT_NAME, handler);
  }, []);
  return readActionLog(filter);
}

/** Dev-only: clear the entire log + re-seed with the historical fixture. */
export function resetActionLog(): void {
  store = SEEDED_HISTORY.slice();
  saveToStorage();
  broadcast();
}

// ── Seeded history ────────────────────────────────────────────
// 18 entries spread across the last ~10 days. Mix of agent + admin
// + system actions so first-paint Activity Feed has real-looking
// content. References Finn's POs / SKUs / suppliers / venues from
// mockData.ts.

const D = (daysAgo: number, hour: number, minute = 0): string => {
  const d = new Date('2026-05-16T00:00:00.000Z');
  d.setUTCDate(d.getUTCDate() - daysAgo);
  d.setUTCHours(hour, minute, 0, 0);
  return d.toISOString();
};

const SEEDED_HISTORY: ActionLogEntry[] = [
  // Today (May 16)
  { id: 'act-100001', at: D(0,  9, 12), actorType: 'system', actorId: 'system', actorLabel: 'System',
    kind: 'sku-restock-trigger',  entity: { type: 'sku', id: 'SKU-0101' },
    summary: 'Par floor breach: Wagyu Ribeye MB7+ at 5/8 kg · Stake',
    category: 'Protein', venue: 'ST', outcome: 'success' },
  { id: 'act-100002', at: D(0,  9, 14), actorType: 'agent',  actorId: 'A-02', actorLabel: 'Restock Agent',
    kind: 'po-create', entity: { type: 'po', id: 'PO-3043' },
    summary: 'Drafted Rush PO-3043 · AUS Premium Meats · Wagyu 6kg · USD 1,840 (FX 15,490)',
    category: 'Protein', venue: 'ST', outcome: 'pending',
    details: 'Promoted to WF-RSH because par floor breached. Skipped RFQ — direct to contracted Wagyu vendor.' },
  { id: 'act-100003', at: D(0, 10,  8), actorType: 'admin', actorId: 'admin', actorLabel: 'You',
    kind: 'po-stage-advance', entity: { type: 'po', id: 'PO-3045' },
    summary: 'Confirmed delivery on PO-3045 · Sumber Dairy · QC pass at BC kitchen',
    category: 'Dairy', venue: 'BC', outcome: 'success' },
  { id: 'act-100004', at: D(0, 11, 32), actorType: 'agent',  actorId: 'A-03', actorLabel: 'Vendor Comms Agent',
    kind: 'po-message-supplier', entity: { type: 'po', id: 'PO-3041' },
    summary: 'Sent WhatsApp to Wayan Sukma · confirming PO-3041 quote · read 14:08',
    category: 'Seafood', venue: 'Multi', outcome: 'success' },
  { id: 'act-100005', at: D(0, 13, 45), actorType: 'admin', actorId: 'admin', actorLabel: 'You',
    kind: 'sku-adjust', entity: { type: 'sku', id: 'SKU-0421' },
    summary: 'Adjusted Yellowfin Tuna (sashimi grade) onHand: 12 → 8 kg',
    category: 'Seafood', venue: 'ST', outcome: 'success',
    details: 'Manual count discrepancy on BC walk-in cooler · 4kg variance noted for cycle-count audit.' },
  // Yesterday (May 15)
  { id: 'act-100006', at: D(1,  6,  5), actorType: 'system', actorId: 'system', actorLabel: 'System',
    kind: 'sku-restock-trigger', entity: { type: 'sku', id: 'SKU-0201' },
    summary: 'Scheduled recurring trigger: weekly produce from CV Indo Sayur',
    category: 'Produce', venue: 'Multi', outcome: 'success' },
  { id: 'act-100007', at: D(1,  6, 30), actorType: 'agent',  actorId: 'A-04', actorLabel: 'Spend Watchdog',
    kind: 'po-approve', entity: { type: 'po', id: 'PO-3042' },
    summary: 'Auto-approved PO-3042 · CV Indo Sayur · Rp 4.8M · under recurring spend cap',
    category: 'Produce', venue: 'Multi', outcome: 'success' },
  { id: 'act-100008', at: D(1, 11, 20), actorType: 'admin', actorId: 'admin', actorLabel: 'You',
    kind: 'savings-lock', entity: { type: 'po', id: 'PO-2993' },
    summary: 'Locked Rp 490,000 saving · Wagyu Ribeye bulk negotiation · AUS Premium Meats',
    category: 'Protein', venue: 'ST', outcome: 'success' },
  { id: 'act-100009', at: D(1, 14, 50), actorType: 'agent',  actorId: 'A-04', actorLabel: 'Spend Watchdog',
    kind: 'po-decline', entity: { type: 'po', id: 'PO-3047' },
    summary: 'Held PO-3047 · Eka Packaging quote +18% above market · RUL-001 fired',
    category: 'Other', venue: 'SP', outcome: 'overridden',
    details: 'Held under standing Spend Cap rule. F&B Director raised DSP-101 to override.' },
  { id: 'act-100010', at: D(1, 16, 12), actorType: 'admin', actorId: 'admin', actorLabel: 'You',
    kind: 'dispute-approve', entity: { type: 'dispute', id: 'DSP-101' },
    summary: 'Approved override on DSP-101 · Splash event needs takeaway boxes · accept +18% premium',
    category: 'Other', venue: 'SP', outcome: 'success' },
  // 2 days ago (May 14)
  { id: 'act-100011', at: D(2,  8, 18), actorType: 'agent',  actorId: 'A-01', actorLabel: 'Sourcing Agent',
    kind: 'po-create', entity: { type: 'po', id: 'PO-3044' },
    summary: 'Drafted PO-3044 · Bintang Distribusi · 180 cases · BC + SP + RC',
    category: 'Beverages', venue: 'Multi', outcome: 'success' },
  { id: 'act-100012', at: D(2,  9, 45), actorType: 'admin', actorId: 'admin', actorLabel: 'You',
    kind: 'po-approve', entity: { type: 'po', id: 'PO-3044' },
    summary: 'Approved PO-3044 · Bintang Distribusi · Rp 9.4M',
    category: 'Beverages', venue: 'Multi', outcome: 'success' },
  { id: 'act-100013', at: D(2, 14, 20), actorType: 'admin', actorId: 'admin', actorLabel: 'You',
    kind: 'sku-par-floor-set', entity: { type: 'sku', id: 'SKU-0421' },
    summary: 'Hardened par floor: Yellowfin Tuna (sashimi) → 8 kg',
    category: 'Seafood', venue: 'ST', outcome: 'success' },
  // 3 days ago (May 13)
  { id: 'act-100014', at: D(3, 10,  0), actorType: 'admin', actorId: 'admin', actorLabel: 'You',
    kind: 'rule-create', entity: { type: 'rule', id: 'RUL-001' },
    summary: 'Created Spend Cap rule · vendor scope · Rp 50M threshold · PT Wine Cellar Nusa',
    venue: 'Multi', outcome: 'success' },
  { id: 'act-100015', at: D(3, 15, 30), actorType: 'agent',  actorId: 'A-05', actorLabel: 'Logistics Agent',
    kind: 'po-stage-advance', entity: { type: 'po', id: 'PO-3045' },
    summary: 'PO-3045 dispatched · Sumber Dairy → BC kitchen · ETA May 16 09:42',
    category: 'Dairy', venue: 'BC', outcome: 'success' },
  // 4 days ago (May 12)
  { id: 'act-100016', at: D(4, 11, 15), actorType: 'admin', actorId: 'admin', actorLabel: 'You',
    kind: 'autonomy-mode-change', entity: { type: 'platform', id: 'autonomy' },
    summary: 'Autonomy set to Auto',
    outcome: 'success',
    meta: { prior: 'assist', next: 'auto' } },
  // 6 days ago (May 10)
  { id: 'act-100017', at: D(6,  8,  0), actorType: 'agent',  actorId: 'A-01', actorLabel: 'Sourcing Agent',
    kind: 'po-create', entity: { type: 'po', id: 'PO-2993' },
    summary: 'Drafted PO-2993 · AUS Premium Meats · Wagyu MB7+ monthly · USD 2,010 · ST',
    category: 'Protein', venue: 'ST', outcome: 'success' },
  // 9 days ago (May 7)
  { id: 'act-100018', at: D(9, 14, 30), actorType: 'agent',  actorId: 'A-01', actorLabel: 'Sourcing Agent',
    kind: 'vendor-renegotiate', entity: { type: 'supplier', id: 'SUP-009' },
    summary: 'Renegotiated AUS Premium Meats Q2 terms · 4% volume break on Wagyu',
    category: 'Protein', venue: 'ST', outcome: 'success' },
];
