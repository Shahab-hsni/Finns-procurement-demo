/**
 * Finn's — Source Bridge Store
 *
 * Persistent conversation threads with vendors, scoped per PO. The
 * Source Bridge panel on Orders writes outbound messages here and
 * reads back the full thread (inbound quote + prior admin messages +
 * synthesized vendor replies) so the user always sees the full
 * conversation in one place.
 *
 * Bali context: WhatsApp / email is the system of record for vendor
 * comms — no portal handshake exists. The thread here mirrors what
 * the admin would see on their phone.
 *
 * Mirrors the pattern of poStore / rfqStore — module-level state +
 * localStorage persistence + CustomEvent broadcast for React hooks.
 */

import { useEffect, useState } from 'react';

export type BridgeChannel = 'whatsapp' | 'email';
export type BridgeAuthor  = 'admin' | 'vendor';
/** Source of the message — drives the bubble's "where did this come from?" tag. */
export type BridgeMessageKind =
  | 'inbound-quote'    // the original RFQ reply that started this PO (vendor)
  | 'reply'            // any subsequent admin or vendor message
  | 'po-sent'          // system-generated "PO sent" announcement
  | 'dispatch-confirm' // vendor's dispatch confirmation
  | 'delivery-confirm'
  | 'dispute-draft';   // A-03 auto-drafted dispute message — editable before send

export interface BridgeMessage {
  id: string;            // stable id for React keys + persistence
  poId: string;
  author: BridgeAuthor;
  authorLabel: string;   // display name; for vendor, the AM name
  channel: BridgeChannel;
  kind: BridgeMessageKind;
  text: string;
  sentAt: string;        // ISO
}

const STORAGE_KEY = 'finns-source-bridge-threads';
const EVENT_NAME  = 'finns-source-bridge-changed';

let store: Record<string, BridgeMessage[]> = loadFromStorage();
let initialized = false;

function loadFromStorage(): Record<string, BridgeMessage[]> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, BridgeMessage[]>;
  } catch {
    return {};
  }
}

function saveToStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* ignore quota errors — demo only */
  }
}

function broadcast(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

function init(): void {
  if (initialized) return;
  initialized = true;
  if (typeof window === 'undefined') return;
  // Re-sync from localStorage in case another tab wrote first.
  store = loadFromStorage();
}

// ── Public API ─────────────────────────────────────────────────

export function readThread(poId: string): BridgeMessage[] {
  init();
  return (store[poId] ?? []).slice().sort((a, b) => a.sentAt.localeCompare(b.sentAt));
}

/** Append one message to a PO's thread. */
export function appendMessage(msg: Omit<BridgeMessage, 'id' | 'sentAt'> & { sentAt?: string }): BridgeMessage {
  init();
  const full: BridgeMessage = {
    ...msg,
    id: `${msg.poId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    sentAt: msg.sentAt ?? new Date().toISOString(),
  };
  store[msg.poId] = [...(store[msg.poId] ?? []), full];
  saveToStorage();
  broadcast();
  return full;
}

/** Replace a PO's entire thread (used by demo seeders). */
export function setThread(poId: string, messages: BridgeMessage[]): void {
  init();
  store[poId] = messages;
  saveToStorage();
  broadcast();
}

/** Clear demo state — wired to existing reset paths if needed. */
export function resetSourceBridge(): void {
  init();
  store = {};
  saveToStorage();
  broadcast();
}

/** React hook — returns the thread for a single PO and re-renders on changes. */
export function useThread(poId: string | null | undefined): BridgeMessage[] {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = () => setTick(t => t + 1);
    window.addEventListener(EVENT_NAME, handler);
    return () => window.removeEventListener(EVENT_NAME, handler);
  }, []);
  if (!poId) return [];
  return readThread(poId);
}
