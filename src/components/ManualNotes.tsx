/**
 * Finn's — Manual-mode Notes (Phase 4l)
 *
 * Editable text surface that lives in the right panel of Orders /
 * Inventory / Suppliers (and anywhere else an entity is the focus).
 * Substitutes for the agent reasoning slot when no agent is acting,
 * but works in every Autonomy mode — admins can drop a note whenever
 * they want.
 *
 * Persistence: `lib/entityNotes.ts` (localStorage per entity).
 * Audit trail: every save emits one `entity-note-edit` action log
 * entry (so Activity & Governance can surface "you edited the note
 * on PO-3041 at 14:32" without needing to render the full note text).
 *
 * Visual treatment:
 *   - Collapsed by default if empty; expanded if there's saved content.
 *   - Header carries the relative "last edited" timestamp.
 *   - "Edit" toggles a textarea + Save/Cancel.
 */

import { useState, useEffect } from 'react';
import { StickyNote, Pencil, X, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Textarea } from './ui/textarea';
import { Button } from './ui/button';
import { useEntityNote, setEntityNote, type NoteEntityType } from '../lib/entityNotes';
import { logUserAction, type ActionEntityType } from '../lib/actionLog';

interface ManualNotesProps {
  isDark: boolean;
  /** Entity type: 'po' | 'sku' | 'supplier'. */
  type: NoteEntityType;
  /** Canonical id (e.g. PO-3041, SKU-0421, SUP-014). */
  id: string;
  /** Short display label for the entity (e.g. "PO-3041 · Bali Seafood"). */
  entityLabel: string;
  /** Optional outer wrapper className. */
  className?: string;
}

const REL_TIME = (iso: string): string => {
  const now = Date.now();
  const at  = new Date(iso).getTime();
  const ms  = now - at;
  const min = Math.round(ms / 60000);
  if (min < 1)        return 'just now';
  if (min < 60)       return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24)        return `${hr}h ago`;
  const d = Math.round(hr / 24);
  if (d < 7)          return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// Map NoteEntityType to ActionEntityType (same values today, but kept
// explicit so the two evolve independently).
const ACTION_ENTITY: Record<NoteEntityType, ActionEntityType> = {
  po:       'po',
  sku:      'sku',
  supplier: 'supplier',
};

export function ManualNotes({ isDark, type, id, entityLabel, className }: ManualNotesProps) {
  const note = useEntityNote(type, id);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(note?.text ?? '');

  // Refresh draft when the underlying entity changes.
  useEffect(() => {
    setDraft(note?.text ?? '');
    setEditing(false);
  }, [type, id]);

  const hasNote = !!note && note.text.trim().length > 0;

  const handleSave = () => {
    const trimmed = draft.trim();
    const isDelete = trimmed.length === 0 && hasNote;
    setEntityNote(type, id, trimmed);
    logUserAction({
      kind: 'entity-note-edit',
      entity: { type: ACTION_ENTITY[type], id },
      summary: isDelete
        ? `Cleared notes on ${entityLabel}`
        : `${hasNote ? 'Updated' : 'Added'} notes on ${entityLabel}`,
      details: trimmed.length > 0 ? trimmed.slice(0, 200) : undefined,
      meta: { length: trimmed.length, deleted: isDelete },
    });
    toast.success(isDelete ? 'Notes cleared' : 'Notes saved', {
      description: entityLabel,
    });
    setEditing(false);
  };

  const handleCancel = () => {
    setDraft(note?.text ?? '');
    setEditing(false);
  };

  const wrapClass = `p-3 rounded-lg border ${
    isDark ? 'bg-[#1a1a1a] border-gray-800' : 'bg-white border-gray-200'
  } ${className ?? ''}`;

  return (
    <div className={wrapClass}>
      <div className="flex items-center gap-2 mb-1.5">
        <StickyNote className={`h-3.5 w-3.5 ${isDark ? 'text-amber-300' : 'text-amber-700'}`} />
        <span className={`text-[10px] font-bold uppercase tracking-wide ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>
          Your notes
        </span>
        {note && (
          <span className={`text-[9px] ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
            edited {REL_TIME(note.updatedAt)}
          </span>
        )}
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className={`ml-auto inline-flex items-center gap-1 text-[10px] font-semibold transition-colors ${
              isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-800'
            }`}>
            <Pencil className="h-3 w-3" /> {hasNote ? 'Edit' : 'Add note'}
          </button>
        )}
      </div>

      {editing ? (
        <>
          <Textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            rows={4}
            placeholder={`What do you want to remember about ${entityLabel}? Receiving notes, vendor quirks, follow-ups, open questions...`}
            className={`text-xs ${isDark ? 'bg-[#2a2a2a] border-gray-700 text-white placeholder:text-gray-500' : 'bg-white border-gray-300 text-gray-900 placeholder:text-gray-400'}`}
          />
          <div className="flex items-center justify-end gap-2 mt-2">
            <Button variant="outline" onClick={handleCancel}
                    className={isDark ? 'bg-transparent border-gray-700 text-gray-300 hover:bg-gray-800 h-7 px-2 text-[10px]' : 'h-7 px-2 text-[10px]'}>
              <X className="h-3 w-3 mr-1" /> Cancel
            </Button>
            <Button onClick={handleSave}
                    className="bg-[#4bbcbe] hover:bg-[#2c9a9c] text-white h-7 px-2.5 text-[10px]">
              <Save className="h-3 w-3 mr-1" /> Save
            </Button>
          </div>
        </>
      ) : hasNote ? (
        <p className={`text-[11px] leading-relaxed whitespace-pre-wrap ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
          {note!.text}
        </p>
      ) : (
        <p className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
          No notes yet. Drop reminders, follow-ups, or context that doesn't fit elsewhere.
        </p>
      )}
    </div>
  );
}
