/**
 * Finn's — Vendor Onboarding Mini-Wizard
 *
 * Manual surface that replaces the previous broken "Onboard New Vendor"
 * CTA on Suppliers (which redirected to the New Request page — wrong
 * surface). 4 steps:
 *
 *   1. Lead     — vendor identity + categories + venues + account mgr
 *   2. KYC      — registration, tax, halal/BPOM, expiry dates
 *   3. Banking  — account routing + payment terms
 *   4. Terms    — first-PO lead time, MOQ, cold-chain, vetting baseline
 *
 * Submission logs an action log entry of kind 'vendor-onboard' with
 * the full vendor draft as meta. The vendor is queued for admin
 * review — actual directory append is admin-driven in a later phase.
 *
 * REALISM-AUDIT gap #1 in pattern 11. Off-mode replacement for A-03
 * (Vendor Comms) intake. Available in all modes.
 */

import { useState } from 'react';
import { X, Lock, ChevronLeft, ChevronRight, Check, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import type { FinnsCategory, VenueTag } from '../lib/types';
import { logUserAction } from '../lib/actionLog';
import { useAutonomyMode, AUTONOMY_LABEL } from '../lib/autonomy';

interface VendorOnboardingModalProps {
  isDark: boolean;
  isOpen: boolean;
  onClose: () => void;
}

const FINNS_CATEGORIES: FinnsCategory[] = [
  'Protein', 'Seafood', 'Produce', 'Dry Goods', 'Dairy', 'Beverages', 'Other',
];
const FINNS_VENUE_TAGS: { tag: VenueTag; name: string }[] = [
  { tag: 'BC', name: 'Beach Club' },
  { tag: 'RC', name: 'Recreation Club' },
  { tag: 'ST', name: 'Stake' },
  { tag: 'SP', name: 'Splash Waterpark' },
];

type VendorType = 'Local' | 'Regional' | 'International';
type PaymentTerm = 'COD' | 'Net-15' | 'Net-30' | 'Net-45' | 'Prepaid';

interface VendorDraft {
  // Step 1 — Lead
  name: string;
  type: VendorType;
  region: string;
  categories: FinnsCategory[];
  venuesServed: VenueTag[];
  accountManager: { name: string; whatsapp: string; telegram: string };
  // Step 2 — KYC
  businessReg: string;       // NIB / SIUP
  taxId: string;             // NPWP
  halalCertId: string;       // empty if not halal
  halalExpiry: string;       // ISO date
  bpomNumber: string;        // empty if not BPOM-regulated
  bpomExpiry: string;
  // Step 3 — Banking
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  currency: 'IDR' | 'USD';
  paymentTerm: PaymentTerm;
  lateFeePct: number;
  // Step 4 — First-PO terms
  leadTimeDays: number;
  moq: string;
  coldChainRequired: boolean;
  baselinePricingNotes: string;
  initialComposite: number;  // 50-95 admin starting score
}

const STEPS = [
  { id: 1, label: 'Lead',    desc: 'Identity, categories, account manager' },
  { id: 2, label: 'KYC',     desc: 'Registration, tax, certifications' },
  { id: 3, label: 'Banking', desc: 'Account routing + payment terms' },
  { id: 4, label: 'Terms',   desc: 'Lead time, MOQ, vetting baseline' },
];

const initialDraft = (): VendorDraft => ({
  name: '',
  type: 'Local',
  region: '',
  categories: [],
  venuesServed: [],
  accountManager: { name: '', whatsapp: '', telegram: '' },
  businessReg: '',
  taxId: '',
  halalCertId: '',
  halalExpiry: '',
  bpomNumber: '',
  bpomExpiry: '',
  bankName: '',
  accountHolder: '',
  accountNumber: '',
  currency: 'IDR',
  paymentTerm: 'Net-30',
  lateFeePct: 1.5,
  leadTimeDays: 3,
  moq: '',
  coldChainRequired: false,
  baselinePricingNotes: '',
  initialComposite: 75,
});

export function VendorOnboardingModal({ isDark, isOpen, onClose }: VendorOnboardingModalProps) {
  const mode = useAutonomyMode();
  const [step, setStep]   = useState<1 | 2 | 3 | 4>(1);
  const [draft, setDraft] = useState<VendorDraft>(initialDraft());

  const patch = <K extends keyof VendorDraft>(key: K, value: VendorDraft[K]) =>
    setDraft(prev => ({ ...prev, [key]: value }));
  const patchAM = (am: Partial<VendorDraft['accountManager']>) =>
    setDraft(prev => ({ ...prev, accountManager: { ...prev.accountManager, ...am } }));

  const toggleCategory = (c: FinnsCategory) =>
    setDraft(prev => ({
      ...prev,
      categories: prev.categories.includes(c)
        ? prev.categories.filter(x => x !== c)
        : [...prev.categories, c],
    }));
  const toggleVenue = (v: VenueTag) =>
    setDraft(prev => ({
      ...prev,
      venuesServed: prev.venuesServed.includes(v)
        ? prev.venuesServed.filter(x => x !== v)
        : [...prev.venuesServed, v],
    }));

  // ── Step validation ────────────────────────────────────────
  const step1Valid =
    draft.name.trim().length > 0 &&
    draft.region.trim().length > 0 &&
    draft.categories.length > 0 &&
    draft.venuesServed.length > 0 &&
    draft.accountManager.name.trim().length > 0 &&
    draft.accountManager.whatsapp.trim().length > 0;
  const step2Valid =
    draft.businessReg.trim().length > 0 &&
    draft.taxId.trim().length > 0;
  const step3Valid =
    draft.bankName.trim().length > 0 &&
    draft.accountHolder.trim().length > 0 &&
    draft.accountNumber.trim().length > 0;
  const step4Valid = draft.leadTimeDays > 0 && draft.moq.trim().length > 0;

  const currentValid =
    step === 1 ? step1Valid :
    step === 2 ? step2Valid :
    step === 3 ? step3Valid :
                 step4Valid;

  const allValid = step1Valid && step2Valid && step3Valid && step4Valid;

  // ── Submit ─────────────────────────────────────────────────
  const handleSubmit = () => {
    if (!allValid) return;
    const supplierId = `SUP-${String(Math.floor(Math.random() * 900) + 100)}`;
    const venueTag = draft.venuesServed.length === 1 ? draft.venuesServed[0] : 'Multi';
    const summary = `Onboarded ${draft.name} · ${draft.type} · ${draft.categories.join(' / ')} · ${draft.region}`;
    logUserAction({
      kind: 'vendor-onboard',
      entity: { type: 'supplier', id: supplierId },
      summary,
      category: draft.categories[0],
      venue: venueTag,
      details: `Payment ${draft.paymentTerm} ${draft.currency}. Lead ${draft.leadTimeDays}d. MOQ ${draft.moq}. ${draft.coldChainRequired ? 'Cold-chain required.' : ''} Account mgr: ${draft.accountManager.name} (${draft.accountManager.whatsapp}).`,
      meta: {
        draft,
        supplierId,
        autonomyModeAtOnboard: mode,
      },
    });
    toast.success(`${draft.name} queued for directory`, {
      description: `Vendor ID ${supplierId}. KYC docs pending admin review before first PO.`,
    });
    setStep(1);
    setDraft(initialDraft());
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
              <h2 className={`text-base font-bold ${textPrimary}`}>Onboard New Vendor</h2>
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
              Step {step} of 4 · {STEPS[step - 1].desc}
            </p>
            {/* Stepper */}
            <div className="mt-3 flex items-center gap-1">
              {STEPS.map((s, idx) => {
                const done = s.id < step;
                const active = s.id === step;
                return (
                  <div key={s.id} className="flex items-center gap-1 flex-1">
                    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-semibold ${
                      active ? chipActive
                        : done ? (isDark ? 'text-[#82d3d5]' : 'text-[#2c9a9c]')
                              : textMuted
                    }`}>
                      <span className={`h-4 w-4 rounded-full flex items-center justify-center text-[9px] font-bold ${
                        active
                          ? 'bg-[#4bbcbe] text-white'
                          : done
                            ? isDark ? 'bg-[#4bbcbe]/30 text-[#82d3d5]' : 'bg-[#4bbcbe]/20 text-[#2c9a9c]'
                            : isDark ? 'bg-gray-800 text-gray-500' : 'bg-gray-100 text-gray-400'
                      }`}>
                        {done ? <Check className="h-2.5 w-2.5" /> : s.id}
                      </span>
                      {s.label}
                    </div>
                    {idx < STEPS.length - 1 && (
                      <div className={`flex-1 h-0.5 rounded ${done ? 'bg-[#4bbcbe]' : isDark ? 'bg-gray-800' : 'bg-gray-200'}`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <button onClick={onClose}
                  className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">

          {/* STEP 1 — Lead */}
          {step === 1 && (
            <>
              <section className="grid grid-cols-2 gap-3">
                <div>
                  <Label className={`text-[10px] uppercase tracking-wide font-bold ${textMuted}`}>Vendor name *</Label>
                  <Input value={draft.name} onChange={e => patch('name', e.target.value)}
                         placeholder="e.g. PT Sumber Pangan Nusantara"
                         className={`mt-1 text-xs ${inputClass}`} />
                </div>
                <div>
                  <Label className={`text-[10px] uppercase tracking-wide font-bold ${textMuted}`}>Type *</Label>
                  <select value={draft.type} onChange={e => patch('type', e.target.value as VendorType)}
                          className={`mt-1 w-full text-xs px-2 py-2 rounded border ${inputClass}`}>
                    {(['Local', 'Regional', 'International'] as const).map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <Label className={`text-[10px] uppercase tracking-wide font-bold ${textMuted}`}>Region *</Label>
                  <Input value={draft.region} onChange={e => patch('region', e.target.value)}
                         placeholder="Bali / Java / Australia"
                         className={`mt-1 text-xs ${inputClass}`} />
                </div>
              </section>

              <section>
                <Label className={`text-[10px] uppercase tracking-wide font-bold ${textMuted}`}>Categories *</Label>
                <div className="mt-1 flex flex-wrap gap-1">
                  {FINNS_CATEGORIES.map(c => {
                    const active = draft.categories.includes(c);
                    return (
                      <button key={c} onClick={() => toggleCategory(c)}
                              className={`text-[10px] px-2 py-1 rounded-full border ${active ? chipActive : chipIdle}`}>
                        {c}
                      </button>
                    );
                  })}
                </div>
              </section>

              <section>
                <Label className={`text-[10px] uppercase tracking-wide font-bold ${textMuted}`}>Venues served *</Label>
                <div className="mt-1 grid grid-cols-4 gap-1">
                  {FINNS_VENUE_TAGS.map(v => {
                    const active = draft.venuesServed.includes(v.tag);
                    return (
                      <button key={v.tag} onClick={() => toggleVenue(v.tag)}
                              className={`text-left text-[10px] px-2 py-1.5 rounded border ${active ? chipActive : chipIdle}`}>
                        <div className="font-bold">{v.tag}</div>
                        <div className="text-[9px] opacity-80">{v.name}</div>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section>
                <Label className={`text-[10px] uppercase tracking-wide font-bold ${textMuted}`}>Account manager *</Label>
                <div className="mt-1 grid grid-cols-3 gap-2">
                  <Input value={draft.accountManager.name} onChange={e => patchAM({ name: e.target.value })}
                         placeholder="Full name"
                         className={`text-xs ${inputClass}`} />
                  <Input value={draft.accountManager.whatsapp} onChange={e => patchAM({ whatsapp: e.target.value })}
                         placeholder="WhatsApp (+62…)"
                         className={`text-xs ${inputClass}`} />
                  <Input value={draft.accountManager.telegram} onChange={e => patchAM({ telegram: e.target.value })}
                         placeholder="Telegram (optional)"
                         className={`text-xs ${inputClass}`} />
                </div>
              </section>
            </>
          )}

          {/* STEP 2 — KYC */}
          {step === 2 && (
            <>
              <section className="grid grid-cols-2 gap-3">
                <div>
                  <Label className={`text-[10px] uppercase tracking-wide font-bold ${textMuted}`}>Business registration (NIB/SIUP) *</Label>
                  <Input value={draft.businessReg} onChange={e => patch('businessReg', e.target.value)}
                         className={`mt-1 text-xs ${inputClass}`} />
                </div>
                <div>
                  <Label className={`text-[10px] uppercase tracking-wide font-bold ${textMuted}`}>Tax ID (NPWP) *</Label>
                  <Input value={draft.taxId} onChange={e => patch('taxId', e.target.value)}
                         className={`mt-1 text-xs ${inputClass}`} />
                </div>
              </section>

              <section className={`p-3 rounded-lg border ${isDark ? 'bg-[#2a2a2a] border-gray-800' : 'bg-gray-50 border-gray-200'}`}>
                <Label className={`text-[10px] uppercase tracking-wide font-bold ${textMuted}`}>Halal certification</Label>
                <p className={`text-[10px] mt-0.5 ${textMuted}`}>Required for Beach Club, Stake, and Splash. Leave blank if not applicable.</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Input value={draft.halalCertId} onChange={e => patch('halalCertId', e.target.value)}
                         placeholder="MUI cert number"
                         className={`text-xs ${inputClass}`} />
                  <Input type="date" value={draft.halalExpiry} onChange={e => patch('halalExpiry', e.target.value)}
                         className={`text-xs ${inputClass}`} />
                </div>
              </section>

              <section className={`p-3 rounded-lg border ${isDark ? 'bg-[#2a2a2a] border-gray-800' : 'bg-gray-50 border-gray-200'}`}>
                <Label className={`text-[10px] uppercase tracking-wide font-bold ${textMuted}`}>BPOM (food regulator)</Label>
                <p className={`text-[10px] mt-0.5 ${textMuted}`}>Required for prepared food, dairy, beverages. Leave blank if not applicable.</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Input value={draft.bpomNumber} onChange={e => patch('bpomNumber', e.target.value)}
                         placeholder="BPOM RI MD…"
                         className={`text-xs ${inputClass}`} />
                  <Input type="date" value={draft.bpomExpiry} onChange={e => patch('bpomExpiry', e.target.value)}
                         className={`text-xs ${inputClass}`} />
                </div>
              </section>
            </>
          )}

          {/* STEP 3 — Banking */}
          {step === 3 && (
            <>
              <section className="grid grid-cols-2 gap-3">
                <div>
                  <Label className={`text-[10px] uppercase tracking-wide font-bold ${textMuted}`}>Bank name *</Label>
                  <Input value={draft.bankName} onChange={e => patch('bankName', e.target.value)}
                         placeholder="BCA / Mandiri / BNI"
                         className={`mt-1 text-xs ${inputClass}`} />
                </div>
                <div>
                  <Label className={`text-[10px] uppercase tracking-wide font-bold ${textMuted}`}>Currency *</Label>
                  <select value={draft.currency} onChange={e => patch('currency', e.target.value as 'IDR' | 'USD')}
                          className={`mt-1 w-full text-xs px-2 py-2 rounded border ${inputClass}`}>
                    <option value="IDR">IDR</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <Label className={`text-[10px] uppercase tracking-wide font-bold ${textMuted}`}>Account holder *</Label>
                  <Input value={draft.accountHolder} onChange={e => patch('accountHolder', e.target.value)}
                         className={`mt-1 text-xs ${inputClass}`} />
                </div>
                <div className="col-span-2">
                  <Label className={`text-[10px] uppercase tracking-wide font-bold ${textMuted}`}>Account number *</Label>
                  <Input value={draft.accountNumber} onChange={e => patch('accountNumber', e.target.value)}
                         className={`mt-1 text-xs ${inputClass}`} />
                </div>
                <div>
                  <Label className={`text-[10px] uppercase tracking-wide font-bold ${textMuted}`}>Payment terms</Label>
                  <select value={draft.paymentTerm} onChange={e => patch('paymentTerm', e.target.value as PaymentTerm)}
                          className={`mt-1 w-full text-xs px-2 py-2 rounded border ${inputClass}`}>
                    {(['COD', 'Net-15', 'Net-30', 'Net-45', 'Prepaid'] as const).map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <Label className={`text-[10px] uppercase tracking-wide font-bold ${textMuted}`}>Late-fee %/day</Label>
                  <Input type="number" min={0} step={0.1} value={draft.lateFeePct}
                         onChange={e => patch('lateFeePct', Number(e.target.value) || 0)}
                         className={`mt-1 text-xs ${inputClass}`} />
                </div>
              </section>
            </>
          )}

          {/* STEP 4 — First-PO Terms */}
          {step === 4 && (
            <>
              <section className="grid grid-cols-2 gap-3">
                <div>
                  <Label className={`text-[10px] uppercase tracking-wide font-bold ${textMuted}`}>Expected lead time (days) *</Label>
                  <Input type="number" min={1} value={draft.leadTimeDays}
                         onChange={e => patch('leadTimeDays', Number(e.target.value) || 0)}
                         className={`mt-1 text-xs ${inputClass}`} />
                </div>
                <div>
                  <Label className={`text-[10px] uppercase tracking-wide font-bold ${textMuted}`}>MOQ *</Label>
                  <Input value={draft.moq} onChange={e => patch('moq', e.target.value)}
                         placeholder="e.g. 20kg per drop"
                         className={`mt-1 text-xs ${inputClass}`} />
                </div>
              </section>

              <section className={`p-3 rounded-lg border flex items-center gap-3 ${isDark ? 'bg-[#2a2a2a] border-gray-800' : 'bg-gray-50 border-gray-200'}`}>
                <input type="checkbox" id="coldchain"
                       checked={draft.coldChainRequired}
                       onChange={e => patch('coldChainRequired', e.target.checked)}
                       className="h-4 w-4 accent-[#4bbcbe]" />
                <label htmlFor="coldchain" className={`text-xs ${textPrimary}`}>
                  Cold-chain required (proteins, seafood, dairy)
                </label>
              </section>

              <section>
                <Label className={`text-[10px] uppercase tracking-wide font-bold ${textMuted}`}>Baseline pricing notes</Label>
                <Textarea value={draft.baselinePricingNotes}
                          onChange={e => patch('baselinePricingNotes', e.target.value)}
                          rows={3}
                          placeholder="e.g. Wagyu MB7+ at AUD 240/kg ex-Sydney. FX locked at 15,490 for the first 4 weeks."
                          className={`mt-1 text-xs ${inputClass}`} />
              </section>

              <section>
                <Label className={`text-[10px] uppercase tracking-wide font-bold ${textMuted}`}>
                  Initial composite score · {draft.initialComposite}/100
                </Label>
                <p className={`text-[10px] mt-0.5 ${textMuted}`}>
                  Your starting trust score for this vendor. A-04 will recalibrate against on-time, quality, and SLA after the first 3 POs.
                </p>
                <input type="range" min={50} max={95} value={draft.initialComposite}
                       onChange={e => patch('initialComposite', Number(e.target.value))}
                       className="w-full mt-2 accent-[#4bbcbe]" />
              </section>
            </>
          )}
        </div>

        {/* Footer */}
        <div className={`shrink-0 flex items-center justify-between gap-3 p-4 border-t ${panelBorder}`}>
          <div className={`text-[10px] ${textMuted}`}>
            {currentValid ? 'Ready · click Next' : 'Fill required fields (marked *) to continue.'}
          </div>
          <div className="flex items-center gap-2">
            {step > 1 && (
              <Button variant="outline" onClick={() => setStep((step - 1) as 1 | 2 | 3 | 4)}
                      className={isDark ? 'bg-transparent border-gray-700 text-gray-300 hover:bg-gray-800' : ''}>
                <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Back
              </Button>
            )}
            {step < 4 && (
              <Button onClick={() => setStep((step + 1) as 1 | 2 | 3 | 4)} disabled={!currentValid}
                      className="bg-[#4bbcbe] hover:bg-[#2c9a9c] text-white disabled:opacity-40 disabled:cursor-not-allowed">
                Next <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            )}
            {step === 4 && (
              <Button onClick={handleSubmit} disabled={!allValid}
                      className="bg-[#4bbcbe] hover:bg-[#2c9a9c] text-white disabled:opacity-40 disabled:cursor-not-allowed">
                <Send className="h-3.5 w-3.5 mr-1.5" /> Queue for directory
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
