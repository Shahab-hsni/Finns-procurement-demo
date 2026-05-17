/**
 * Finn's — Entity Notes
 *
 * Tiny per-entity notes store. Backs the Manual-mode Notes surface
 * (Phase 4l) — the editable text area that lives in the right panel
 * of Orders / Inventory / Suppliers and substitutes for the agent
 * reasoning slot when no agent is acting.
 *
 * Storage model
 * -------------
 * One localStorage key (`finns-entity-notes`) holds a single map:
 *
 *   { [`${type}:${id}`]: { text: string; updatedAt: ISO } }
 *
 * Module-level cache + CustomEvent broadcast so subscribers re-render
 * on save (mirrors the actionLog.ts pattern).
 *
 * Notes are intentionally NOT folded into the unified action log —
 * the log records *what changed*, and entity notes are a continuous
 * scratch surface that gets edited frequently. Each save emits one
 * `entity-note-edit` action log entry as an audit trail; the actual
 * note content lives here.
 */

import { useEffect, useState } from 'react';

export type NoteEntityType = 'po' | 'sku' | 'supplier';

export interface EntityNote {
  text: string;
  updatedAt: string;
}

type Store = Record<string, EntityNote>;

const STORAGE_KEY = 'finns-entity-notes';
const EVENT_NAME  = 'finns-entity-notes-changed';

let store: Store = {};
let initialized = false;

function keyOf(type: NoteEntityType, id: string): string {
  return `${type}:${id}`;
}

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
    /* localStorage may be full or disabled — silently drop */
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

/** Read a note synchronously. Returns null if none saved. */
export function readEntityNote(type: NoteEntityType, id: string): EntityNote | null {
  init();
  return store[keyOf(type, id)] ?? null;
}

/** Save a note. Empty text deletes the entry. */
export function setEntityNote(type: NoteEntityType, id: string, text: string): EntityNote | null {
  init();
  const key = keyOf(type, id);
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    delete store[key];
    saveToStorage();
    broadcast();
    return null;
  }
  const next: EntityNote = { text: trimmed, updatedAt: new Date().toISOString() };
  store[key] = next;
  saveToStorage();
  broadcast();
  return next;
}

/** Subscribe to changes for a specific entity. */
export function useEntityNote(type: NoteEntityType, id: string | null): EntityNote | null {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = () => setTick(t => t + 1);
    window.addEventListener(EVENT_NAME, handler);
    return () => window.removeEventListener(EVENT_NAME, handler);
  }, []);
  if (!id) return null;
  return readEntityNote(type, id);
}

/** Dev-only: clear all notes. */
export function resetEntityNotes(): void {
  store = {};
  saveToStorage();
  broadcast();
}
