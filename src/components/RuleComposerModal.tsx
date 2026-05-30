/**
 * Finn's — Rule Composer Modal (Phase 4m)
 *
 * Replaces the toast-stubbed "+ New rule" and "Edit" buttons on the
 * Activity & Governance Policy tab with a real modal that composes a
 * `PolicyRule`. Four templates today:
 *
 *   spend-cap          — block POs above threshold (per vendor / category / all)
 *   vendor-trust-floor — block vendors below composite score
 *   fraud-hold         — flag duplicate-amount POs within a time window
 *   delivery-sla       — alert when shipment late beyond max hours
 *
 * The seeded rules in lib/mockData.ts are read-only; user-composed
 * rules live in AIActivityPage state (passed in as `rules` / setters).
 * Submission emits a `rule-create` or `rule-edit` entry on the action
 * log so Activity Feed picks the change up.
 */

import { useEffect, useState } from 'react';
import { X, Plus, Save, Lock, Shield, AlertTriangle, Truck, Award, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import type { PolicyRule, PolicyTemplate, PolicyScope } from '../lib/types';
import { logUserAction } from '../lib/actionLog';
import { useAutonomyMode, AUTONOMY_LABEL } from '../lib/autonomy';

interface RuleComposerModalProps {
  isDark: boolean;
  isOpen: boolean;
  /** When set, the modal is in "edit" mode. When null, it's a fresh rule. */
  editing: PolicyRule | null;
  onClose: () => void;
  /** Append a newly-created rule. */
  onCreate: (rule: PolicyRule) => void;
  /** Update an edited rule in place. */
  onUpdate: (rule: PolicyRule) => void;
  /** Optional: delete an edited rule. Disabled in 'create' mode. */
  onDelete?: (ruleId: string) => void;
}

const TEMPLATE_META: Record<PolicyTemplate, { label: string; icon: typeof Shield; desc: string }> = {
  'spend-cap':          { label: 'Spend cap',           icon: AlertTriangle, desc: 'Block POs above a money threshold.' },
  'vendor-trust-floor': { label: 'Vendor trust floor',  icon: Shield,        desc: 'Block vendors below a composite score.' },
  'fraud-hold':         { label: 'Fraud hold',          icon: AlertTriangle, desc: 'Flag duplicate-amount POs within a time window.' },
  'delivery-sla':       { label: 'Delivery SLA',        icon: Truck,         desc: 'Alert when shipment runs late past max hours.' },
};

const SCOPE_OPTIONS: { id: PolicyScope; label: string }[] = [
  { id: 'all',      label: 'All entities' },
  { id: 'vendor',   label: 'Specific vendor' },
  { id: 'category', label: 'Category' },
  { id: 'venue',    label: 'Venue' },
  { id: 'agent',    label: 'Agent' },
];

interface ConfigDraft {
  // spend-cap
  threshold?: number;
  currency?: 'IDR' | 'USD';
  // vendor-trust-floor
  compositeFloor?: number;
  // fraud-hold
  windowHours?: number;
  exactAmountMatch?: boolean;
  // delivery-sla
  maxLateHours?: number;
}

function initialDraft(rule: PolicyRule | null): {
  template: PolicyTemplate;
  name: string;
  scope: PolicyScope;
  scopeTarget: string;
  config: ConfigDraft;
  active: boolean;
} {
  if (rule) {
    const c = rule.config as Record<string, unknown>;
    return {
      template: rule.template,
      name: rule.name,
      scope: rule.scope,
      scopeTarget: (c.scopeTarget as string) ?? '',
      config: {
        threshold:        typeof c.threshold === 'number' ? c.threshold : undefined,
        currency:         (c.currency as 'IDR' | 'USD') ?? 'IDR',
        compositeFloor:   typeof c.threshold === 'number' && rule.template === 'vendor-trust-floor'
                          ? c.threshold
                          : undefined,
        windowHours:      typeof c.window_hours === 'number' ? c.window_hours : undefined,
        exactAmountMatch: typeof c.exact_amount_match === 'boolean' ? c.exact_amount_match : undefined,
        maxLateHours:     typeof c.max_late_hours === 'number' ? c.max_late_hours : undefined,
      },
      active: rule.active,
    };
  }
  return {
    template: 'spend-cap',
    name: '',
    scope: 'all',
    scopeTarget: '',
    config: { threshold: 10_000_000, currency: 'IDR' },
    active: true,
  };
}

export function RuleComposerModal({
  isDark, isOpen, editing, onClose, onCreate, onUpdate, onDelete,
}: RuleComposerModalProps) {
  const mode = useAutonomyMode();
  const [draft, setDraft] = useState(() => initialDraft(editing));

  // Re-seed draft when the underlying editing target changes.
  useEffect(() => {
    setDraft(initialDraft(editing));
  }, [editing, isOpen]);

  const setTemplate = (template: PolicyTemplate) => {
    // Reset template-specific config defaults so switching is clean.
    let config: ConfigDraft = {};
    if (template === 'spend-cap')          config = { threshold: 10_000_000, currency: 'IDR' };
    if (template === 'vendor-trust-floor') config = { compositeFloor: 70 };
    if (template === 'fraud-hold')         config = { windowHours: 72, exactAmountMatch: true };
    if (template === 'delivery-sla')       config = { maxLateHours: 24 };
    setDraft(d => ({ ...d, template, config }));
  };

  // Validation per template.
  const valid = (() => {
    if (draft.name.trim().length === 0) return false;
    if (draft.scope !== 'all' && draft.scopeTarget.trim().length === 0) return false;
    if (draft.template === 'spend-cap')          return (draft.config.threshold ?? 0) > 0;
    if (draft.template === 'vendor-trust-floor') return (draft.config.compositeFloor ?? -1) >= 0 && (draft.config.compositeFloor ?? 101) <= 100;
    if (draft.template === 'fraud-hold')         return (draft.config.windowHours ?? 0) > 0;
    if (draft.template === 'delivery-sla')       return (draft.config.maxLateHours ?? 0) > 0;
    return false;
  })();

  const buildConfig = (): Record<string, unknown> => {
    const out: Record<string, unknown> = {};
    if (draft.scope !== 'all' && draft.scopeTarget.trim()) out.scopeTarget = draft.scopeTarget.trim();
    if (draft.template === 'spend-cap') {
      out.threshold = draft.config.threshold;
      out.currency  = draft.config.currency;
    } else if (draft.template === 'vendor-trust-floor') {
      out.threshold = draft.config.compositeFloor;
    } else if (draft.template === 'fraud-hold') {
      out.window_hours = draft.config.windowHours;
      out.exact_amount_match = draft.config.exactAmountMatch;
    } else if (draft.template === 'delivery-sla') {
      out.max_late_hours = draft.config.maxLateHours;
    }
    return out;
  };

  const handleSubmit = () => {
    if (!valid) return;
    const config = buildConfig();
    if (editing) {
      const updated: PolicyRule = {
        ...editing,
        template: draft.template,
        name: draft.name.trim(),
        scope: draft.scope,
        active: draft.active,
        config,
      };
      onUpdate(updated);
      logUserAction({
        kind: 'rule-edit',
        entity: { type: 'rule', id: updated.id },
        summary: `Edited ${updated.id} · ${updated.name}`,
        details: `Template ${updated.template} · scope ${updated.scope}${updated.active ? '' : ' · disabled'}`,
        meta: { template: updated.template, scope: updated.scope, active: updated.active, config },
      });
      toast.success(`Saved ${updated.id}`, { description: updated.name });
    } else {
      const id = `RUL-${String(Math.floor(Math.random() * 900) + 100)}`;
      const created: PolicyRule = {
        id,
        template: draft.template,
        name: draft.name.trim(),
        scope: draft.scope,
        active: draft.active,
        createdBy: 'Procurement Manager',
        createdAt: new Date().toISOString().slice(0, 10),
        triggers: 0,
        config,
      };
      onCreate(created);
      logUserAction({
        kind: 'rule-create',
        entity: { type: 'rule', id: created.id },
        summary: `Created ${created.id} · ${created.name}`,
        details: `Template ${created.template} · scope ${created.scope}${created.active ? '' : ' · disabled'}`,
        meta: { template: created.template, scope: created.scope, active: created.active, config },
      });
      toast.success(`Created ${created.id}`, { description: created.name });
    }
    onClose();
  };

  const handleDelete = () => {
    if (!editing || !onDelete) return;
    onDelete(editing.id);
    logUserAction({
      kind: 'rule-delete',
      entity: { type: 'rule', id: editing.id },
      summary: `Deleted ${editing.id} · ${editing.name}`,
    });
    toast.warning(`Deleted ${editing.id}`, { description: 'Rule removed from the active set.' });
    onClose();
  };

  if (!isOpen) return null;

  const panelBg     = isDark ? 'bg-[#1a1a1a]' : 'bg-white';
  const panelBorder = isDark ? 'border-gray-800' : 'border-gray-200';
  const textPrimary = isDark ? 'text-white' : 'text-gray-900';
  const textMuted   = isDark ? 'text-gray-400' : 'text-gray-600';
  const inputClass  = `${isDark ? 'bg-[#2a2a2a] border-gray-700 text-white placeholder:text-gray-500' : 'bg-white border-gray-300 text-gray-900 placeholder:text-gray-400'}`;
  const chipActive  = isDark ? 'bg-[#4bbcbe]/20 text-[#82d3d5] border-[#4bbcbe]/50' : 'bg-[#eafafa] text-[#2c9a9c] border-[#4bbcbe]/40';
  const chipIdle    = isDark ? 'bg-[#2a2a2a] text-gray-400 border-gray-700 hover:border-gray-600' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ background: 'rgba(0,0,0,0.55)' }}
         onClick={onClose}>
      <div className={`relative w-full max-w-2xl max-h-[90vh] rounded-2xl border shadow-2xl flex flex-col ${panelBg} ${panelBorder}`}
           onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={`shrink-0 flex items-start justify-between gap-3 p-5 border-b ${panelBorder}`}>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className={`text-base font-bold ${textPrimary}`}>
                {editing ? `Edit ${editing.id}` : 'New policy rule'}
              </h2>
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                isDark ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-50 text-amber-700'
              }`}>
                <Lock className="h-2.5 w-2.5" /> Enforced by A-04
              </span>
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${chipIdle}`}>
                Autonomy: {AUTONOMY_LABEL[mode]}
              </span>
            </div>
            <p className={`text-xs mt-1 ${textMuted}`}>
              {editing
                ? 'Adjust template, scope, threshold, or active state. Saves as a new audit row.'
                : 'Compose a hard gate that A-04 (Spend Watchdog) enforces on every PO.'}
            </p>
          </div>
          <button onClick={onClose}
                  className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">

          {/* Template selector */}
          <section>
            <Label className={`text-[10px] uppercase tracking-wide font-bold ${textMuted}`}>Template</Label>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {(Object.keys(TEMPLATE_META) as PolicyTemplate[]).map(tk => {
                const meta = TEMPLATE_META[tk];
                const Icon = meta.icon;
                const active = draft.template === tk;
                return (
                  <button key={tk} onClick={() => setTemplate(tk)}
                          className={`text-left p-2.5 rounded-lg border transition-colors ${active ? chipActive : chipIdle}`}>
                    <div className="flex items-center gap-1.5">
                      <Icon className="h-3.5 w-3.5" />
                      <span className="text-xs font-semibold">{meta.label}</span>
                    </div>
                    <p className="text-[10px] mt-1 opacity-80">{meta.desc}</p>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Name */}
          <section>
            <Label className={`text-[10px] uppercase tracking-wide font-bold ${textMuted}`}>Name *</Label>
            <Input value={draft.name}
                   onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                   placeholder={`e.g. "${TEMPLATE_META[draft.template].label} · Wine vendors"`}
                   className={`mt-1 text-xs ${inputClass}`} />
          </section>

          {/* Scope */}
          <section>
            <Label className={`text-[10px] uppercase tracking-wide font-bold ${textMuted}`}>Scope</Label>
            <div className="mt-1 flex flex-wrap gap-1">
              {SCOPE_OPTIONS.map(s => {
                const active = draft.scope === s.id;
                return (
                  <button key={s.id} onClick={() => setDraft(d => ({ ...d, scope: s.id, scopeTarget: s.id === 'all' ? '' : d.scopeTarget }))}
                          className={`text-[10px] px-2 py-1 rounded-full border ${active ? chipActive : chipIdle}`}>
                    {s.label}
                  </button>
                );
              })}
            </div>
            {draft.scope !== 'all' && (
              <Input
                value={draft.scopeTarget}
                onChange={e => setDraft(d => ({ ...d, scopeTarget: e.target.value }))}
                placeholder={`Target ${draft.scope} (e.g. ${draft.scope === 'vendor' ? 'PT Wine Cellar Nusa' : draft.scope === 'category' ? 'Beverages' : draft.scope === 'venue' ? 'BC' : 'A-01'})`}
                className={`mt-2 text-xs ${inputClass}`}
              />
            )}
          </section>

          {/* Template-specific config */}
          <section className={`p-3 rounded-lg border ${isDark ? 'bg-[#2a2a2a] border-gray-800' : 'bg-gray-50 border-gray-200'}`}>
            <Label className={`text-[10px] uppercase tracking-wide font-bold ${textMuted}`}>Configuration</Label>
            <div className="mt-2 space-y-3">
              {draft.template === 'spend-cap' && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <Label className={`text-[9px] ${textMuted}`}>Threshold</Label>
                    <Input type="number" min={1} value={draft.config.threshold ?? ''}
                           onChange={e => setDraft(d => ({ ...d, config: { ...d.config, threshold: Number(e.target.value) || 0 } }))}
                           className={`mt-1 text-xs ${inputClass}`} />
                  </div>
                  <div>
                    <Label className={`text-[9px] ${textMuted}`}>Currency</Label>
                    <select value={draft.config.currency ?? 'IDR'}
                            onChange={e => setDraft(d => ({ ...d, config: { ...d.config, currency: e.target.value as 'IDR' | 'USD' } }))}
                            className={`mt-1 w-full text-xs px-2 py-2 rounded border ${inputClass}`}>
                      <option value="IDR">IDR</option>
                      <option value="USD">USD</option>
                    </select>
                  </div>
                  <p className={`col-span-3 text-[10px] ${textMuted}`}>
                    Blocks any PO above {(draft.config.threshold ?? 0).toLocaleString()} {draft.config.currency}. Disputes can override.
                  </p>
                </div>
              )}

              {draft.template === 'vendor-trust-floor' && (
                <div>
                  <Label className={`text-[9px] ${textMuted}`}>Composite floor · {draft.config.compositeFloor ?? 0}/100</Label>
                  <input type="range" min={0} max={100} value={draft.config.compositeFloor ?? 70}
                         onChange={e => setDraft(d => ({ ...d, config: { ...d.config, compositeFloor: Number(e.target.value) } }))}
                         className="w-full mt-2 accent-[#4bbcbe]" />
                  <p className={`text-[10px] mt-1 ${textMuted}`}>
                    Vendors below this composite score are blocked from new POs.
                  </p>
                </div>
              )}

              {draft.template === 'fraud-hold' && (
                <>
                  <div>
                    <Label className={`text-[9px] ${textMuted}`}>Window (hours)</Label>
                    <Input type="number" min={1} value={draft.config.windowHours ?? ''}
                           onChange={e => setDraft(d => ({ ...d, config: { ...d.config, windowHours: Number(e.target.value) || 0 } }))}
                           className={`mt-1 text-xs ${inputClass}`} />
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="exact-match"
                           checked={!!draft.config.exactAmountMatch}
                           onChange={e => setDraft(d => ({ ...d, config: { ...d.config, exactAmountMatch: e.target.checked } }))}
                           className="h-4 w-4 accent-[#4bbcbe]" />
                    <label htmlFor="exact-match" className={`text-[11px] ${textPrimary}`}>
                      Require exact amount match
                    </label>
                  </div>
                  <p className={`text-[10px] ${textMuted}`}>
                    Holds POs whose amount matches another PO within {draft.config.windowHours ?? '?'} hours{draft.config.exactAmountMatch ? ' (exact match)' : ' (loose match)'}.
                  </p>
                </>
              )}

              {draft.template === 'delivery-sla' && (
                <div>
                  <Label className={`text-[9px] ${textMuted}`}>Max late hours before alert</Label>
                  <Input type="number" min={1} value={draft.config.maxLateHours ?? ''}
                         onChange={e => setDraft(d => ({ ...d, config: { ...d.config, maxLateHours: Number(e.target.value) || 0 } }))}
                         className={`mt-1 text-xs ${inputClass}`} />
                  <p className={`text-[10px] mt-1 ${textMuted}`}>
                    Alerts A-05 (Logistics) + raises a dispute when a delivery runs more than {draft.config.maxLateHours ?? '?'}h past ETA.
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* Active toggle */}
          <section className={`p-3 rounded-lg border flex items-center gap-3 ${isDark ? 'bg-[#2a2a2a] border-gray-800' : 'bg-gray-50 border-gray-200'}`}>
            <input type="checkbox" id="active-toggle"
                   checked={draft.active}
                   onChange={e => setDraft(d => ({ ...d, active: e.target.checked }))}
                   className="h-4 w-4 accent-[#4bbcbe]" />
            <label htmlFor="active-toggle" className={`text-xs flex-1 ${textPrimary}`}>
              <span className="font-semibold">Active</span>
              <span className={`block text-[10px] ${textMuted}`}>
                When off, the rule is saved but not enforced. Useful for staging tightenings before they bite.
              </span>
            </label>
          </section>
        </div>

        {/* Footer */}
        <div className={`shrink-0 flex items-center justify-between gap-3 p-4 border-t ${panelBorder}`}>
          <div>
            {editing && onDelete && (
              <button onClick={handleDelete}
                      className={`text-[10px] inline-flex items-center gap-1 px-2 py-1 rounded border transition-colors ${
                        isDark ? 'border-red-500/40 text-red-400 hover:bg-red-500/10' : 'border-red-300/70 text-red-600 hover:bg-red-50'
                      }`}>
                <Trash2 className="h-3 w-3" /> Delete rule
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose}
                    className={isDark ? 'bg-transparent border-gray-700 text-gray-300 hover:bg-gray-800' : ''}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!valid}
                    className="bg-[#4bbcbe] hover:bg-[#2c9a9c] text-white disabled:opacity-40 disabled:cursor-not-allowed">
              {editing ? <><Save className="h-3.5 w-3.5 mr-1.5" /> Save changes</> : <><Plus className="h-3.5 w-3.5 mr-1.5" /> Create rule</>}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
