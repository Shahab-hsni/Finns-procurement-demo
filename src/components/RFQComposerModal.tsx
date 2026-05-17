/**
 * Finn's — RFQ Composer Modal
 *
 * Manual sourcing surface. Off mode replacement for A-01 (Sourcing).
 *
 * The user picks one or more vendors from the approved directory,
 * lists the items they need quotes on, sets a quote deadline, and
 * sends the RFQ via WhatsApp / Email. Submission logs an action log
 * entry of kind 'rfq-send' so the Activity & Governance Action Log
 * picks it up automatically.
 *
 * Scope for this commit:
 *   - Compose + send only. No "Pending RFQ" tracker, no quote
 *     ingestion. Those land in later phases (4h.2 / 4h.3).
 *   - All three Autonomy modes can open this modal. In Assist/Auto
 *     the agent would normally do this automatically; offering it
 *     manually is a deliberate override.
 *
 * Trigger: "Compose RFQ" button in the New Request page header.
 */

import { useState, useMemo } from 'react';
import { X, Plus, Trash2, Send, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { finnsSuppliers } from '../lib/mockData';
import type { FinnsCategory, VenueTag } from '../lib/types';
import { logUserAction } from '../lib/actionLog';
import { useAutonomyMode, AUTONOMY_LABEL } from '../lib/autonomy';

interface RFQComposerModalProps {
  isDark: boolean;
  isOpen: boolean;
  onClose: () => void;
}

interface RFQLineItem {
  id: string;
  name: string;
  category: FinnsCategory | '';
  qty: number;
  unit: string;
}

const FINNS_CATEGORIES: FinnsCategory[] = [
  'Protein', 'Seafood', 'Produce', 'Dry Goods', 'Dairy', 'Beverages', 'Other',
];

const COMMON_UNITS = ['kg', 'g', 'unit', 'box', 'case', 'L', 'ml', 'bottle'];

const newLineItem = (): RFQLineItem => ({
  id: `li-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  name: '',
  category: '',
  qty: 1,
  unit: 'kg',
});

export function RFQComposerModal({ isDark, isOpen, onClose }: RFQComposerModalProps) {
  const mode = useAutonomyMode();
  const [items, setItems]           = useState<RFQLineItem[]>([newLineItem()]);
  const [selectedVendorIds, setSelectedVendorIds] = useState<string[]>([]);
  const [categoryFilter, setCategoryFilter]       = useState<FinnsCategory | 'all'>('all');
  const [deadline, setDeadline]     = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().slice(0, 10);
  });
  const [notes, setNotes]           = useState<string>('');
  const [channel, setChannel]       = useState<'whatsapp' | 'email'>('whatsapp');

  // ── Filtered vendor directory ──────────────────────────────
  const filteredVendors = useMemo(() => {
    if (categoryFilter === 'all') return finnsSuppliers;
    return finnsSuppliers.filter(v => v.categories.includes(categoryFilter));
  }, [categoryFilter]);

  // ── Handlers ────────────────────────────────────────────────
  const addItem    = () => setItems(prev => [...prev, newLineItem()]);
  const removeItem = (id: string) => setItems(prev => prev.filter(i => i.id !== id));
  const updateItem = (id: string, patch: Partial<RFQLineItem>) =>
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i));

  const toggleVendor = (id: string) => {
    setSelectedVendorIds(prev =>
      prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]
    );
  };

  const valid =
    items.length > 0 &&
    items.every(i => i.name.trim().length > 0 && i.qty > 0) &&
    selectedVendorIds.length > 0 &&
    deadline.length > 0;

  const handleSubmit = () => {
    if (!valid) return;
    const vendorNames = selectedVendorIds
      .map(id => finnsSuppliers.find(v => v.id === id)?.name ?? id);
    const itemSummary = items
      .map(i => `${i.qty}${i.unit} ${i.name}`)
      .join(', ');
    // Pick venue from the vendors' served venues — if all share one, tag it;
    // otherwise 'Multi'.
    const allVenues = new Set<VenueTag>();
    selectedVendorIds.forEach(id => {
      finnsSuppliers.find(v => v.id === id)?.venuesServed.forEach(t => allVenues.add(t));
    });
    const venueTag = allVenues.size === 1 ? Array.from(allVenues)[0] : 'Multi';
    // Pick category from first item (best-effort).
    const category = items.find(i => i.category)?.category || undefined;

    logUserAction({
      kind: 'rfq-send',
      entity: { type: 'supplier', id: selectedVendorIds[0] },
      summary: `Sent RFQ to ${vendorNames.length} vendor${vendorNames.length === 1 ? '' : 's'} · ${itemSummary.slice(0, 60)}${itemSummary.length > 60 ? '…' : ''}`,
      category: category || undefined,
      venue: venueTag,
      details: `Vendors: ${vendorNames.join(', ')}. Deadline ${deadline}. Channel: ${channel}.${notes ? ` Notes: ${notes}` : ''}`,
      meta: {
        vendorIds: selectedVendorIds,
        itemCount: items.length,
        deadline,
        channel,
        autonomyModeAtSend: mode,
      },
    });

    toast.success(`RFQ sent to ${vendorNames.length} vendor${vendorNames.length === 1 ? '' : 's'}`, {
      description: `Quotes due ${deadline}. They'll surface here once received.`,
    });

    // Reset + close.
    setItems([newLineItem()]);
    setSelectedVendorIds([]);
    setNotes('');
    onClose();
  };

  if (!isOpen) return null;

  const panelBg     = isDark ? 'bg-[#1a1a1a]' : 'bg-white';
  const panelBorder = isDark ? 'border-gray-800' : 'border-gray-200';
  const textPrimary = isDark ? 'text-white' : 'text-gray-900';
  const textMuted   = isDark ? 'text-gray-400' : 'text-gray-600';
  const inputClass  = `${isDark ? 'bg-[#2a2a2a] border-gray-700 text-white placeholder:text-gray-500' : 'bg-white border-gray-300 text-gray-900 placeholder:text-gray-400'}`;
  const chipActive  = isDark ? 'bg-[#87986a]/20 text-[#a3b085] border-[#87986a]/50' : 'bg-[#f4f6f0] text-[#6b7a54] border-[#87986a]/40';
  const chipIdle    = isDark ? 'bg-[#2a2a2a] text-gray-400 border-gray-700 hover:border-gray-600' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ background: 'rgba(0,0,0,0.55)' }}
         onClick={onClose}>
      <div className={`relative w-full max-w-3xl max-h-[88vh] rounded-2xl border shadow-2xl flex flex-col ${panelBg} ${panelBorder}`}
           onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={`shrink-0 flex items-start justify-between gap-3 p-5 border-b ${panelBorder}`}>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className={`text-base font-bold ${textPrimary}`}>Compose RFQ</h2>
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                isDark ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-50 text-amber-700'
              }`}>
                <Lock className="h-2.5 w-2.5" /> Internal Directory
              </span>
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${chipIdle}`}>
                Autonomy: {AUTONOMY_LABEL[mode]}
              </span>
            </div>
            <p className={`text-xs mt-1 ${textMuted}`}>
              Manually source quotes from the approved vendor directory. Quotes return here once received.
            </p>
          </div>
          <button onClick={onClose}
                  className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-5">

          {/* Line items */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <Label className={`text-[10px] uppercase tracking-wide font-bold ${textMuted}`}>Items requesting quotes on</Label>
              <button onClick={addItem}
                      className={`inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-md border transition-colors ${
                        isDark ? 'border-gray-700 text-gray-300 hover:bg-gray-800' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}>
                <Plus className="h-3 w-3" /> Add line item
              </button>
            </div>
            <div className="space-y-2">
              {items.map(it => (
                <div key={it.id}
                     className={`flex items-center gap-2 p-2.5 rounded-lg border ${isDark ? 'bg-[#2a2a2a] border-gray-800' : 'bg-gray-50 border-gray-200'}`}>
                  <Input
                    placeholder="Item name (e.g. Yellowfin tuna sashimi grade)"
                    value={it.name}
                    onChange={e => updateItem(it.id, { name: e.target.value })}
                    className={`flex-1 text-xs ${inputClass}`}
                  />
                  <select
                    value={it.category}
                    onChange={e => updateItem(it.id, { category: e.target.value as FinnsCategory })}
                    className={`text-xs px-2 py-1.5 rounded border ${inputClass} w-28`}>
                    <option value="">Category</option>
                    {FINNS_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <Input
                    type="number"
                    min={1}
                    value={it.qty}
                    onChange={e => updateItem(it.id, { qty: Number(e.target.value) || 0 })}
                    className={`w-16 text-xs ${inputClass}`}
                  />
                  <select
                    value={it.unit}
                    onChange={e => updateItem(it.id, { unit: e.target.value })}
                    className={`text-xs px-2 py-1.5 rounded border ${inputClass} w-20`}>
                    {COMMON_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                  <button
                    onClick={() => removeItem(it.id)}
                    disabled={items.length === 1}
                    className={`shrink-0 w-7 h-7 rounded-md flex items-center justify-center transition-colors ${
                      items.length === 1
                        ? isDark ? 'text-gray-700 cursor-not-allowed' : 'text-gray-300 cursor-not-allowed'
                        : isDark ? 'text-red-400 hover:bg-red-500/10' : 'text-red-500 hover:bg-red-50'
                    }`}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Vendor selection */}
          <section>
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <Label className={`text-[10px] uppercase tracking-wide font-bold ${textMuted}`}>
                Send to ({selectedVendorIds.length} selected)
              </Label>
              <div className="flex items-center gap-1 flex-wrap">
                <button onClick={() => setCategoryFilter('all')}
                        className={`text-[9px] px-1.5 py-0.5 rounded-full border ${categoryFilter === 'all' ? chipActive : chipIdle}`}>
                  All
                </button>
                {FINNS_CATEGORIES.map(c => (
                  <button key={c} onClick={() => setCategoryFilter(c)}
                          className={`text-[9px] px-1.5 py-0.5 rounded-full border ${categoryFilter === c ? chipActive : chipIdle}`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div className={`max-h-48 overflow-y-auto rounded-lg border divide-y ${isDark ? 'border-gray-800 divide-gray-800' : 'border-gray-200 divide-gray-100'}`}>
              {filteredVendors.length === 0 ? (
                <div className={`px-3 py-4 text-center text-[11px] ${textMuted}`}>
                  No vendors match the {categoryFilter} filter.
                </div>
              ) : filteredVendors.map(v => {
                const active = selectedVendorIds.includes(v.id);
                return (
                  <button key={v.id} onClick={() => toggleVendor(v.id)}
                          className={`w-full text-left flex items-center gap-3 px-3 py-2 transition-colors ${
                            active
                              ? isDark ? 'bg-[#87986a]/10' : 'bg-[#f4f6f0]'
                              : isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-50'
                          }`}>
                    <span className={`h-3.5 w-3.5 rounded border flex items-center justify-center shrink-0 ${
                      active
                        ? 'bg-[#87986a] border-[#87986a] text-white'
                        : isDark ? 'border-gray-600' : 'border-gray-300'
                    }`}>
                      {active && '✓'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-semibold ${textPrimary}`}>{v.name}</span>
                        <span className={`text-[9px] ${textMuted}`}>{v.region} · {v.type}</span>
                      </div>
                      <div className={`text-[10px] mt-0.5 ${textMuted}`}>
                        Composite {v.metrics.composite} · On-time {v.metrics.onTime}% · Lead {v.metrics.leadTimeDays}d · {v.categories.join(', ')}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Deadline + channel */}
          <section className="grid grid-cols-2 gap-3">
            <div>
              <Label className={`text-[10px] uppercase tracking-wide font-bold ${textMuted}`}>Quote deadline</Label>
              <Input type="date" value={deadline} onChange={e => setDeadline(e.target.value)}
                     className={`mt-1 text-xs ${inputClass}`} />
            </div>
            <div>
              <Label className={`text-[10px] uppercase tracking-wide font-bold ${textMuted}`}>Send via</Label>
              <div className="mt-1 flex gap-1">
                {(['whatsapp', 'email'] as const).map(c => (
                  <button key={c} onClick={() => setChannel(c)}
                          className={`flex-1 text-xs px-2 py-1.5 rounded-md border transition-colors capitalize ${
                            channel === c ? chipActive : chipIdle
                          }`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Notes */}
          <section>
            <Label className={`text-[10px] uppercase tracking-wide font-bold ${textMuted}`}>Notes (optional)</Label>
            <Textarea
              placeholder="e.g. Delivery window flexible May 20-22. Cold-chain required. ST tasting menu — quality > price."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              className={`mt-1 text-xs ${inputClass}`}
            />
          </section>
        </div>

        {/* Footer */}
        <div className={`shrink-0 flex items-center justify-between gap-3 p-4 border-t ${panelBorder}`}>
          <div className={`text-[10px] ${textMuted}`}>
            {valid
              ? `Ready · ${selectedVendorIds.length} vendor${selectedVendorIds.length === 1 ? '' : 's'} · ${items.length} line item${items.length === 1 ? '' : 's'}`
              : 'Add at least one item and one vendor to send.'}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose}
                    className={isDark ? 'bg-transparent border-gray-700 text-gray-300 hover:bg-gray-800' : ''}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!valid}
                    className="bg-[#87986a] hover:bg-[#6b7a54] text-white disabled:opacity-40 disabled:cursor-not-allowed">
              <Send className="h-3.5 w-3.5 mr-1.5" />
              Send RFQ
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
