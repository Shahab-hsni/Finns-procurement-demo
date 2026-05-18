/**
 * Finn's — RFQ Store (Phase 4h.2)
 *
 * Backs the RFQ Tracker. Created RFQs land here; mock vendor quotes
 * arrive via setTimeout to simulate vendor replies; user awards a
 * winner which synthesises a PO entry on the action log.
 *
 * Storage model
 * -------------
 * One localStorage key (`finns-rfq-store`) holds:
 *
 *   { [rfqId]: RFQRecord }
 *
 * Module-level cache + CustomEvent broadcast on every mutation so
 * subscribers re-render cleanly.
 *
 * Mock quote ingestion
 * --------------------
 * createRFQ() schedules per-vendor setTimeout callbacks. Each callback
 * has a small chance of skipping (vendor "no-bids"), otherwise
 * generates a quote near a per-line-item target with noise. Quote
 * arrivals fire `rfq-quote-received` on the action log so the
 * Activity Feed picks them up. Timers persist only within a session
 * — reload before all quotes land and the remaining ones never fire.
 * Good enough for a demo; future 4h.3 can swap to a server-driven
 * model.
 */

import { useEffect, useState } from 'react';
import { logSystemAction } from './actionLog';
import type { VenueTag, FinnsCategory } from './types';
import { finnsSuppliers } from './mockData';

export type RFQStatus = 'awaiting' | 'partial' | 'received' | 'partially-awarded' | 'awarded' | 'cancelled' | 'expired';
export type RFQChannel = 'whatsapp' | 'email';

export interface RFQLineItem {
  /** Stable id within the RFQ. Used to wire quotes / awards to items. */
  id: string;
  name: string;
  category?: string;
  qty: number;
  unit: string;
  /** Internal target price used to simulate plausible quotes. IDR per unit. */
  targetPriceIdr?: number;
}

export interface RFQQuote {
  /** Vendor id (matches finnsSuppliers ids). */
  vendorId: string;
  /** Display name for the tracker card. */
  vendorName: string;
  /** Items in the basket this vendor can supply (subset of rfq.items). */
  itemIds: string[];
  /** Quoted total in IDR for the items they can supply. */
  totalIdr: number;
  /** Vendor-claimed lead time in days. */
  leadTimeDays: number;
  /** Optional vendor note (e.g. "Cold-chain confirmed for ST drop"). */
  note?: string;
  /** ISO timestamp when the quote arrived. */
  receivedAt: string;
}

/** A single award against the RFQ. A multi-vendor RFQ produces N awards. */
export interface RFQAward {
  vendorId: string;
  vendorName: string;
  /** Items locked to this vendor by this award. */
  itemIds: string[];
  /** Synthesised PO id for this award. */
  poId: string;
  /** Total IDR for this award (from the awarded quote). */
  totalIdr: number;
  leadTimeDays: number;
  awardedAt: string;
}

export interface RFQRecord {
  id: string;
  createdAt: string;
  deadline: string;
  channel: RFQChannel;
  items: RFQLineItem[];
  notes?: string;
  /** Vendor ids invited to quote (subset of finnsSuppliers). */
  vendorIds: string[];
  /** Display labels for invited vendors. */
  vendorNames: string[];
  quotes: RFQQuote[];
  /** All awards on this RFQ. Empty until first award. */
  awards: RFQAward[];
  /** Optional venue tag (carried from creator context). */
  venue?: VenueTag | 'Multi';
  status: RFQStatus;
  // Legacy fields — populated with the FIRST award for back-compat
  // with code that still reads awardedVendorId / awardedPoId.
  awardedVendorId?: string;
  awardedPoId?: string;
}

type Store = Record<string, RFQRecord>;

const STORAGE_KEY = 'finns-rfq-store';
const EVENT_NAME  = 'finns-rfq-changed';

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

function deriveStatus(r: RFQRecord): RFQStatus {
  if (r.status === 'cancelled' || r.status === 'expired') return r.status;
  const totalItems    = r.items.length;
  const awardedSet    = new Set<string>(r.awards.flatMap(a => a.itemIds));
  if (totalItems > 0 && awardedSet.size >= totalItems) return 'awarded';
  if (r.awards.length > 0)                              return 'partially-awarded';
  if (r.quotes.length === 0)                            return 'awaiting';
  if (r.quotes.length < r.vendorIds.length)             return 'partial';
  return 'received';
}

function persist(): void {
  saveToStorage();
  broadcast();
}

// ── Public API ─────────────────────────────────────────────────

export interface CreateRFQInput {
  id: string;
  deadline: string;
  channel: RFQChannel;
  items: RFQLineItem[];
  notes?: string;
  vendorIds: string[];
  vendorNames: string[];
  venue?: VenueTag | 'Multi';
}

/** Create + schedule mock quote arrivals. */
export function createRFQ(input: CreateRFQInput): RFQRecord {
  init();
  const record: RFQRecord = {
    ...input,
    createdAt: new Date().toISOString(),
    quotes: [],
    awards: [],
    status: 'awaiting',
  };
  store[record.id] = record;
  persist();
  scheduleMockQuotes(record.id);
  return record;
}

/** Append a quote to an RFQ. Recomputes status. */
export function addQuote(rfqId: string, quote: RFQQuote): RFQRecord | null {
  init();
  const r = store[rfqId];
  if (!r) return null;
  if (r.status === 'cancelled') return r;
  // Don't double-add for the same vendor.
  if (r.quotes.some(q => q.vendorId === quote.vendorId)) return r;
  const next: RFQRecord = { ...r, quotes: [...r.quotes, quote] };
  next.status = deriveStatus(next);
  store[rfqId] = next;
  persist();
  return next;
}

/**
 * Award a vendor's quote. Locks the items in that quote (minus any
 * already-awarded items) to the vendor. Multiple awards per RFQ
 * are supported — one per quote / vendor.
 */
export function awardRFQ(rfqId: string, vendorId: string, poId: string): RFQRecord | null {
  init();
  const r = store[rfqId];
  if (!r) return null;
  if (r.status === 'cancelled') return r;
  const quote = r.quotes.find(q => q.vendorId === vendorId);
  if (!quote) return r;
  // Items in this quote that haven't been awarded yet.
  const alreadyAwarded = new Set<string>(r.awards.flatMap(a => a.itemIds));
  const newItemIds = quote.itemIds.filter(id => !alreadyAwarded.has(id));
  if (newItemIds.length === 0) return r;          // nothing left to award

  const award: RFQAward = {
    vendorId: quote.vendorId,
    vendorName: quote.vendorName,
    itemIds: newItemIds,
    poId,
    totalIdr: quote.totalIdr,
    leadTimeDays: quote.leadTimeDays,
    awardedAt: new Date().toISOString(),
  };
  const next: RFQRecord = {
    ...r,
    awards: [...r.awards, award],
    // Keep legacy fields populated with the FIRST award so older
    // readers don't break — replace once they're all migrated.
    awardedVendorId: r.awardedVendorId ?? quote.vendorId,
    awardedPoId:     r.awardedPoId     ?? poId,
  };
  next.status = deriveStatus(next);
  store[rfqId] = next;
  persist();
  return next;
}

/** Cancel an RFQ. Existing quotes / awards stay visible for the record. */
export function cancelRFQ(rfqId: string): RFQRecord | null {
  init();
  const r = store[rfqId];
  if (!r) return null;
  if (r.status === 'awarded' || r.status === 'cancelled') return r;
  const next: RFQRecord = { ...r, status: 'cancelled' };
  store[rfqId] = next;
  persist();
  return next;
}

/** Item ids in this RFQ that no award has covered yet. */
export function unawardedItemIds(rfq: RFQRecord): string[] {
  const awarded = new Set<string>(rfq.awards.flatMap(a => a.itemIds));
  return rfq.items.filter(it => !awarded.has(it.id)).map(it => it.id);
}

/** Synchronous read. Newest first. */
export function readRFQs(): RFQRecord[] {
  init();
  return Object.values(store).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** React hook — subscribes to changes. */
export function useRFQs(): RFQRecord[] {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = () => setTick(t => t + 1);
    window.addEventListener(EVENT_NAME, handler);
    return () => window.removeEventListener(EVENT_NAME, handler);
  }, []);
  return readRFQs();
}

/** Dev-only: clear everything. */
export function resetRFQs(): void {
  store = {};
  saveToStorage();
  broadcast();
}

// ── Mock quote scheduling ──────────────────────────────────────
// Per-vendor: 5-14 second delay, 15% chance of "no-bid" (vendor
// skips). Quote total = sum(item.qty * targetPriceIdr) * noise.
// Lead time = base 3-7 days. Cold-chain note 30% of the time.

const COLD_CHAIN_NOTES = [
  'Cold-chain confirmed end-to-end.',
  'Single drop, no transfers — preserves cold chain.',
  'Cold-chain SLA 98% in last 30 days.',
];

const REGULAR_NOTES = [
  'Can hold price for 7 days.',
  'Volume tier 2 unlocked above 50 units.',
  'Receiving window: 06:00–10:00 weekdays.',
  'Includes 1 swap line for any item that fails QC.',
  '',
];

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function scheduleMockQuotes(rfqId: string): void {
  if (typeof window === 'undefined') return;
  init();
  const r = store[rfqId];
  if (!r) return;

  r.vendorIds.forEach((vendorId, idx) => {
    const vendorName = r.vendorNames[idx] ?? vendorId;
    const vendor = finnsSuppliers.find(s => s.id === vendorId);
    // Items in the basket this vendor can actually supply. Scoping the
    // quote here prevents "AUS Premium Meats agreed to deliver tomatoes"
    // type incidents downstream.
    const coveredItems = vendor
      ? r.items.filter(it =>
          it.category && vendor.categories.includes(it.category as FinnsCategory),
        )
      : r.items;
    const delayMs = 5000 + idx * 3500 + Math.floor(Math.random() * 4000);
    setTimeout(() => {
      // Re-read in case the RFQ was cancelled in the meantime.
      const current = store[rfqId];
      if (!current) return;
      if (current.status === 'cancelled') return;
      const channelLabel = r.channel === 'whatsapp' ? 'WhatsApp' : 'email';

      // If the vendor doesn't cover anything in this basket, log a
      // no-bid. (Shouldn't fire when the user picks vendors via the
      // category-aware grouped view, but guards against manual invites.)
      if (coveredItems.length === 0) {
        logSystemAction({
          kind: 'rfq-quote-received',
          entity: { type: 'supplier', id: vendorId },
          summary: `${vendorName} replied via ${channelLabel} — no bid on ${rfqId} (no overlap with their categories)`,
          venue: r.venue,
          outcome: 'overridden',
          meta: { rfqId, vendorId, vendorName, channel: r.channel, passed: true, reason: 'no-overlap' },
        });
        return;
      }

      // 15% random no-bid even for covered vendors (price, capacity, etc.).
      if (Math.random() < 0.15) {
        logSystemAction({
          kind: 'rfq-quote-received',
          entity: { type: 'supplier', id: vendorId },
          summary: `${vendorName} replied via ${channelLabel} — no bid on ${rfqId}`,
          venue: r.venue,
          outcome: 'overridden',
          meta: { rfqId, vendorId, vendorName, channel: r.channel, passed: true },
        });
        return;
      }

      // Total from the items they actually supply.
      const baseTotal = coveredItems.reduce(
        (s, it) => s + it.qty * (it.targetPriceIdr ?? 50_000),
        0,
      );
      const noise = rand(0.85, 1.18); // -15% to +18%
      const totalIdr = Math.round(baseTotal * noise / 10_000) * 10_000;
      const leadTimeDays = Math.round(rand(2, 7));
      const note = Math.random() < 0.3
        ? pick(COLD_CHAIN_NOTES)
        : pick(REGULAR_NOTES) || undefined;
      const quote: RFQQuote = {
        vendorId,
        vendorName,
        itemIds: coveredItems.map(it => it.id),
        totalIdr,
        leadTimeDays,
        note,
        receivedAt: new Date().toISOString(),
      };
      addQuote(rfqId, quote);
      logSystemAction({
        kind: 'rfq-quote-received',
        entity: { type: 'supplier', id: vendorId },
        summary: `${vendorName} replied via ${channelLabel} · Rp ${(totalIdr / 1_000_000).toFixed(2)}M · ${leadTimeDays}d · ${coveredItems.length} item${coveredItems.length === 1 ? '' : 's'}`,
        venue: r.venue,
        details: note,
        meta: { rfqId, vendorId, vendorName, totalIdr, leadTimeDays, channel: r.channel, itemCount: coveredItems.length },
      });
    }, delayMs);
  });
}
