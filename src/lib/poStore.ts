/**
 * Finn's — Runtime PO Store (Phase 4h.3)
 *
 * Holds POs created at runtime (today: only from RFQ awards; later
 * from manual New Request submissions too). NewOrdersPage merges
 * these with its seeded ORDERS const so the same render path works
 * for both.
 *
 * Bali channel context
 * --------------------
 * Every runtime PO carries `quoteChannel` (whatsapp / email / none)
 * so the Orders detail surface can show "Quote received via
 * WhatsApp from Pak Wayan on May 17, 14:32". Finn's vendors don't
 * use portals — they're WhatsApp-first, email if formal — and the
 * UI should always make that visible.
 *
 * Storage: localStorage map keyed by PO id, with module-level cache
 * and CustomEvent broadcast (mirrors rfqStore / entityNotes).
 */

import { useEffect, useState } from 'react';

export type QuoteChannel = 'whatsapp' | 'email' | 'none';

/**
 * The shape NewOrdersPage actually consumes. Matches its local
 * `Order` interface field-for-field for the fields the page reads.
 * Keep in sync if that interface changes.
 */
export interface RuntimePO {
  id: string;
  supplier: string;
  items: string[];
  amount: number;
  amountUsd?: number;
  group: 'needs-action' | 'autonomous';
  actionKind?: 'approve' | 'confirm-delivery' | 'resolve-issue' | 'pay';
  humanAction: string;
  humanStatus: string;
  humanDescription: string;
  eta: string;
  etaMinutes?: number;
  /** 5-stage DAG: 0=Request, 1=Quote/Vendor Confirmed, 2=PO Approved, 3=In Transit, 4=Delivered & Checked. */
  dagStage: number;
  agentReasoning: string;
  agentAgent: string;
  assignedAgent: { id: number; role: string };
  workflowTemplate: string;          // 'WF-STD' | 'WF-RSH' | 'WF-REC'
  status: 'live' | 'completed' | 'disputed' | 'cancelled' | 'on-hold';
  createdAt: string;                 // ISO
  completedAt?: string;
  // ── Bali channel context ───────────────────────────────────
  /** Where the quote came in. 'none' for purely-internal POs. */
  quoteChannel: QuoteChannel;
  /** Account-manager contact label (e.g. "Pak Wayan · +62 812..."). */
  quoteFrom?: string;
  /** ISO timestamp when the quote landed. */
  quoteReceivedAt?: string;
  /** RFQ id this PO was minted from, if any. */
  fromRfqId?: string;
  /** Optional finance copy carried from the quote. */
  financeInsight?: string;
  /** Optional saving snapshot (matches the seeded shape). */
  saving?: { time: string; cost: number };
}

type Store = Record<string, RuntimePO>;

const STORAGE_KEY = 'finns-po-store';
const EVENT_NAME  = 'finns-po-changed';

let store: Store = {};
let initialized = false;

function loadFromStorage(): Store {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed as Store;
    return {};
  } catch {
    return {};
  }
}

function saveToStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* silently drop */
  }
}

function broadcast(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

function init(): void {
  if (initialized) return;
  initialized = true;
  store = loadFromStorage();
}

/** Append a freshly-minted PO. */
export function createPO(po: RuntimePO): RuntimePO {
  init();
  store[po.id] = po;
  saveToStorage();
  broadcast();
  return po;
}

/** Update an existing PO in place (e.g. stage advance). */
export function updatePO(id: string, patch: Partial<RuntimePO>): RuntimePO | null {
  init();
  const cur = store[id];
  if (!cur) return null;
  const next: RuntimePO = { ...cur, ...patch };
  store[id] = next;
  saveToStorage();
  broadcast();
  return next;
}

/** Synchronous read. Newest first. */
export function readRuntimePOs(): RuntimePO[] {
  init();
  return Object.values(store).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** React hook — subscribes to changes. */
export function useRuntimePOs(): RuntimePO[] {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = () => setTick(t => t + 1);
    window.addEventListener(EVENT_NAME, handler);
    return () => window.removeEventListener(EVENT_NAME, handler);
  }, []);
  return readRuntimePOs();
}

/** Dev-only: wipe runtime POs. */
export function resetRuntimePOs(): void {
  store = {};
  saveToStorage();
  broadcast();
}
