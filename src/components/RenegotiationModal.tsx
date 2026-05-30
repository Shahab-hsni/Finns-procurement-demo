/**
 * Finn's — Renegotiation Workspace (lean modal)
 *
 * Replaces the one-click "Initiate Renegotiation" confetti CTA with
 * a 5-step modal that captures the real artifacts of a vendor
 * renegotiation in a single session:
 *
 *   1. Prep brief   — what we have today, what we want, walk-away point
 *   2. Opening offer — your authored counter
 *   3. Counter rounds — alternating vendor / you messages, add as many
 *                       as needed
 *   4. Red-line     — final terms summary
 *   5. Sign         — confirm + persist a single vendor-renegotiate
 *                     action log entry with all rounds as meta
 *
 * Scope locked for this commit: single-session. No cross-session
 * persistence beyond the action log itself. A 4k.2 phase can layer
 * localStorage state + a persistent per-vendor workspace on top.
 *
 * REALISM-AUDIT gap #4 in pattern 11.
 */

import { useState } from 'react';
import {
  X, ChevronLeft, ChevronRight, Check, Send, Lock, Plus, Trash2, FileSignature,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { logUserAction } from '../lib/actionLog';
import { useAutonomyMode, AUTONOMY_LABEL } from '../lib/autonomy';

interface RenegotiationVendor {
  id: string;
  name: string;
  /** Optional category for action log tagging. */
  category?: string;
}

interface RenegotiationModalProps {
  isDark: boolean;
  isOpen: boolean;
  vendor: RenegotiationVendor | null;
  onClose: () => void;
}

type RoundAuthor = 'vendor' | 'you';
interface RenegotiationRound {
  id: string;
  author: RoundAuthor;
  text: string;
}

interface RenegotiationDraft {
  // Step 1 — Prep
  currentTerms: string;
  targetOutcome: string;
  walkAway: string;
  // Step 2 — Opening offer
  openingOffer: string;
  // Step 3 — Rounds (oldest → newest)
  rounds: RenegotiationRound[];
  // Step 4 — Red-line
  finalTerms: string;
  // Step 5 — Sign
  amendmentRef: string;     // e.g. "AMD-2026-014"
  effectiveDate: string;    // ISO
}

const STEPS = [
  { id: 1, label: 'Prep',         desc: 'Current terms, target, walk-away' },
  { id: 2, label: 'Opening',      desc: 'Your opening counter offer' },
  { id: 3, label: 'Rounds',       desc: 'Counter-rounds back and forth' },
  { id: 4, label: 'Red-line',     desc: 'Final terms summary' },
  { id: 5, label: 'Sign',         desc: 'Confirm signed amendment' },
];

const newRound = (author: RoundAuthor): RenegotiationRound => ({
  id: `r-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  author,
  text: '',
});

const initialDraft = (): RenegotiationDraft => ({
  currentTerms: '',
  targetOutcome: '',
  walkAway: '',
  openingOffer: '',
  rounds: [],
  finalTerms: '',
  amendmentRef: `AMD-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900) + 100)}`,
  effectiveDate: new Date().toISOString().slice(0, 10),
});

export function RenegotiationModal({ isDark, isOpen, vendor, onClose }: RenegotiationModalProps) {
  const mode = useAutonomyMode();
  const [step, setStep]   = useState<1 | 2 | 3 | 4 | 5>(1);
  const [draft, setDraft] = useState<RenegotiationDraft>(initialDraft());

  const patch = <K extends keyof RenegotiationDraft>(k: K, v: RenegotiationDraft[K]) =>
    setDraft(prev => ({ ...prev, [k]: v }));

  const addRound = (author: RoundAuthor) =>
    setDraft(prev => ({ ...prev, rounds: [...prev.rounds, newRound(author)] }));
  const removeRound = (id: string) =>
    setDraft(prev => ({ ...prev, rounds: prev.rounds.filter(r => r.id !== id) }));
  const updateRound = (id: string, text: string) =>
    setDraft(prev => ({
      ...prev,
      rounds: prev.rounds.map(r => r.id === id ? { ...r, text } : r),
    }));

  // ── Validation per step ────────────────────────────────────
  const step1Valid =
    draft.currentTerms.trim().length > 0 &&
    draft.targetOutcome.trim().length > 0 &&
    draft.walkAway.trim().length > 0;
  const step2Valid = draft.openingOffer.trim().length > 0;
  const step3Valid = true; // rounds optional — you can sign without them
  const step4Valid = draft.finalTerms.trim().length > 0;
  const step5Valid =
    draft.amendmentRef.trim().length > 0 &&
    draft.effectiveDate.trim().length > 0;
  const currentValid =
    step === 1 ? step1Valid :
    step === 2 ? step2Valid :
    step === 3 ? step3Valid :
    step === 4 ? step4Valid :
                 step5Valid;
  const allValid = step1Valid && step2Valid && step4Valid && step5Valid;

  const reset = () => {
    setDraft(initialDraft());
    setStep(1);
  };

  // ── Submit ─────────────────────────────────────────────────
  const handleSubmit = () => {
    if (!vendor || !allValid) return;
    const summary = `Renegotiated terms with ${vendor.name} · ${draft.amendmentRef} · effective ${draft.effectiveDate}`;
    logUserAction({
      kind: 'vendor-renegotiate',
      entity: { type: 'supplier', id: vendor.id },
      summary,
      details: `Target: ${draft.targetOutcome.slice(0, 100)}${draft.targetOutcome.length > 100 ? '…' : ''} · ${draft.rounds.length} counter-round${draft.rounds.length === 1 ? '' : 's'} exchanged. Final: ${draft.finalTerms.slice(0, 80)}${draft.finalTerms.length > 80 ? '…' : ''}`,
      meta: {
        vendorId: vendor.id,
        vendorName: vendor.name,
        autonomyModeAtSign: mode,
        amendmentRef: draft.amendmentRef,
        effectiveDate: draft.effectiveDate,
        prep: {
          currentTerms: draft.currentTerms,
          targetOutcome: draft.targetOutcome,
          walkAway: draft.walkAway,
        },
        openingOffer: draft.openingOffer,
        rounds: draft.rounds.map(r => ({ author: r.author, text: r.text })),
        finalTerms: draft.finalTerms,
      },
    });
    toast.success(`Amendment ${draft.amendmentRef} signed`, {
      description: `${vendor.name} · effective ${draft.effectiveDate}. Full renegotiation transcript saved to the action log.`,
    });
    reset();
    onClose();
  };

  if (!isOpen || !vendor) return null;

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
         onClick={() => { reset(); onClose(); }}>
      <div className={`relative w-full max-w-3xl max-h-[90vh] rounded-2xl border shadow-2xl flex flex-col ${panelBg} ${panelBorder}`}
           onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={`shrink-0 flex items-start justify-between gap-3 p-5 border-b ${panelBorder}`}>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className={`text-base font-bold ${textPrimary}`}>Renegotiate · {vendor.name}</h2>
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                isDark ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-50 text-amber-700'
              }`}>
                <Lock className="h-2.5 w-2.5" /> Manual session
              </span>
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${chipIdle}`}>
                Autonomy: {AUTONOMY_LABEL[mode]}
              </span>
            </div>
            <p className={`text-xs mt-1 ${textMuted}`}>
              Step {step} of 5 · {STEPS[step - 1].desc}
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
          <button onClick={() => { reset(); onClose(); }}
                  className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">

          {/* STEP 1 — Prep */}
          {step === 1 && (
            <>
              <section>
                <Label className={`text-[10px] uppercase tracking-wide font-bold ${textMuted}`}>Current terms *</Label>
                <p className={`text-[10px] mt-0.5 ${textMuted}`}>What's on the contract today. Price, lead time, MOQ, payment terms, exclusivities.</p>
                <Textarea value={draft.currentTerms} onChange={e => patch('currentTerms', e.target.value)}
                          rows={3}
                          placeholder="e.g. Wagyu MB7+ at AUD 240/kg, 5d lead, MOQ 4kg/cycle, Net-30."
                          className={`mt-1 text-xs ${inputClass}`} />
              </section>
              <section>
                <Label className={`text-[10px] uppercase tracking-wide font-bold ${textMuted}`}>Target outcome *</Label>
                <p className={`text-[10px] mt-0.5 ${textMuted}`}>The version of the deal you'd be happy walking away with.</p>
                <Textarea value={draft.targetOutcome} onChange={e => patch('targetOutcome', e.target.value)}
                          rows={3}
                          placeholder="e.g. 4% volume break above 6kg/cycle, lead time 3d, MOQ unchanged, Net-45 payment, FX lock for Q3."
                          className={`mt-1 text-xs ${inputClass}`} />
              </section>
              <section>
                <Label className={`text-[10px] uppercase tracking-wide font-bold ${textMuted}`}>Walk-away point *</Label>
                <p className={`text-[10px] mt-0.5 ${textMuted}`}>If they won't meet this, you'll source the category elsewhere. Helps anchor the negotiation.</p>
                <Textarea value={draft.walkAway} onChange={e => patch('walkAway', e.target.value)}
                          rows={2}
                          placeholder="e.g. No discount on smaller volumes + lead time stays 5d = we re-RFQ AUS market."
                          className={`mt-1 text-xs ${inputClass}`} />
              </section>
            </>
          )}

          {/* STEP 2 — Opening offer */}
          {step === 2 && (
            <>
              <section>
                <Label className={`text-[10px] uppercase tracking-wide font-bold ${textMuted}`}>Opening offer *</Label>
                <p className={`text-[10px] mt-0.5 ${textMuted}`}>Your authored opening counter. Send via WhatsApp / Email / Source Bridge after you save and close.</p>
                <Textarea value={draft.openingOffer} onChange={e => patch('openingOffer', e.target.value)}
                          rows={6}
                          placeholder={`e.g. "Pak Wayan — based on our Q2 volume we'd like to lock 6kg/cycle at AUD 230/kg through Sep. Open to extending Net-30 to Net-45 in exchange for that volume floor. FX peg at 15,490 for the period. Let me know your read by end of week."`}
                          className={`mt-1 text-xs ${inputClass}`} />
              </section>
              <section className={`p-3 rounded-lg border ${isDark ? 'bg-[#4bbcbe]/8 border-[#4bbcbe]/25' : 'bg-[#eafafa] border-[#c4eef0]'}`}>
                <p className={`text-[10px] leading-relaxed ${textPrimary}`}>
                  <strong>Reminder:</strong> The vendor's account manager + WhatsApp lives on the Suppliers detail page. Send the opening offer through the channel you usually use; record what comes back in the next step.
                </p>
              </section>
            </>
          )}

          {/* STEP 3 — Counter rounds */}
          {step === 3 && (
            <>
              <section>
                <div className="flex items-center justify-between mb-2">
                  <Label className={`text-[10px] uppercase tracking-wide font-bold ${textMuted}`}>Counter rounds</Label>
                  <div className="flex items-center gap-1">
                    <button onClick={() => addRound('vendor')}
                            className={`inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-md border ${
                              isDark ? 'border-gray-700 text-gray-300 hover:bg-gray-800' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                            }`}>
                      <Plus className="h-3 w-3" /> Vendor says…
                    </button>
                    <button onClick={() => addRound('you')}
                            className={`inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-md border ${
                              isDark ? 'border-[#4bbcbe]/40 text-[#82d3d5] hover:bg-[#4bbcbe]/10' : 'border-[#4bbcbe]/40 text-[#2c9a9c] hover:bg-[#eafafa]'
                            }`}>
                      <Plus className="h-3 w-3" /> You reply…
                    </button>
                  </div>
                </div>
                <p className={`text-[10px] mb-2 ${textMuted}`}>
                  Capture the back-and-forth. Rounds are optional — sign now if you're at terms or come back later. (Persistence across sessions lands in 4k.2.)
                </p>
                {draft.rounds.length === 0 ? (
                  <div className={`text-[11px] py-6 text-center rounded-lg border border-dashed ${
                    isDark ? 'border-gray-800 text-gray-500' : 'border-gray-300 text-gray-500'
                  }`}>
                    No counter-rounds yet. Use the buttons above to log a vendor reply or your follow-up.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {draft.rounds.map((r, idx) => {
                      const isVendor = r.author === 'vendor';
                      return (
                        <div key={r.id}
                             className={`p-2.5 rounded-lg border ${
                               isVendor
                                 ? isDark ? 'bg-[#2a2a2a] border-gray-700' : 'bg-gray-50 border-gray-200'
                                 : isDark ? 'bg-[#4bbcbe]/8 border-[#4bbcbe]/30' : 'bg-[#eafafa] border-[#c4eef0]'
                             }`}>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className={`text-[10px] font-bold uppercase tracking-wide ${
                              isVendor ? textMuted
                                       : isDark ? 'text-[#82d3d5]' : 'text-[#2c9a9c]'
                            }`}>
                              Round {idx + 1} · {isVendor ? 'Vendor' : 'You'}
                            </span>
                            <button onClick={() => removeRound(r.id)}
                                    className={`shrink-0 w-6 h-6 rounded-md flex items-center justify-center transition-colors ${
                                      isDark ? 'text-red-400 hover:bg-red-500/10' : 'text-red-500 hover:bg-red-50'
                                    }`}>
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                          <Textarea
                            value={r.text}
                            onChange={e => updateRound(r.id, e.target.value)}
                            rows={3}
                            placeholder={isVendor
                              ? 'Paste / paraphrase what the vendor said — e.g. "Can do 6kg cycle but only 2% discount; Net-30 stays."'
                              : 'Your follow-up — e.g. "Meet me at 3.5% and Net-45 — that\'s our last counter."'}
                            className={`text-xs ${inputClass}`}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </>
          )}

          {/* STEP 4 — Red-line */}
          {step === 4 && (
            <>
              <section>
                <Label className={`text-[10px] uppercase tracking-wide font-bold ${textMuted}`}>Final terms summary *</Label>
                <p className={`text-[10px] mt-0.5 ${textMuted}`}>The agreed-upon terms going into the amendment. This is what gets signed.</p>
                <Textarea value={draft.finalTerms} onChange={e => patch('finalTerms', e.target.value)}
                          rows={7}
                          placeholder={`e.g.
- Price: AUD 232/kg (down from 240)
- Volume floor: 6kg/cycle for the next 6 cycles
- Lead time: 4d (down from 5d)
- Payment: Net-45 (up from Net-30)
- FX peg: 15,490 IDR/AUD through Sep 30
- Exclusivity: none — both sides free to source/sell elsewhere`}
                          className={`mt-1 text-xs ${inputClass}`} />
              </section>
              <section className={`p-3 rounded-lg border ${isDark ? 'bg-[#2a2a2a] border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                <div className={`text-[10px] uppercase tracking-wide font-bold mb-1.5 ${textMuted}`}>Prep recap</div>
                <div className={`text-[10px] space-y-1 ${textPrimary}`}>
                  <p><strong>Target:</strong> {draft.targetOutcome || '(empty)'}</p>
                  <p><strong>Walk-away:</strong> {draft.walkAway || '(empty)'}</p>
                  <p><strong>Rounds exchanged:</strong> {draft.rounds.length}</p>
                </div>
              </section>
            </>
          )}

          {/* STEP 5 — Sign */}
          {step === 5 && (
            <>
              <section className="grid grid-cols-2 gap-3">
                <div>
                  <Label className={`text-[10px] uppercase tracking-wide font-bold ${textMuted}`}>Amendment reference *</Label>
                  <Input value={draft.amendmentRef} onChange={e => patch('amendmentRef', e.target.value)}
                         placeholder="AMD-2026-014"
                         className={`mt-1 text-xs ${inputClass}`} />
                </div>
                <div>
                  <Label className={`text-[10px] uppercase tracking-wide font-bold ${textMuted}`}>Effective date *</Label>
                  <Input type="date" value={draft.effectiveDate}
                         onChange={e => patch('effectiveDate', e.target.value)}
                         className={`mt-1 text-xs ${inputClass}`} />
                </div>
              </section>
              <section className={`p-4 rounded-xl border-2 ${
                isDark ? 'bg-[#4bbcbe]/8 border-[#4bbcbe]/50' : 'bg-[#eafafa] border-[#4bbcbe]/40'
              }`}>
                <div className="flex items-start gap-3">
                  <FileSignature className={`h-5 w-5 mt-0.5 shrink-0 ${isDark ? 'text-[#82d3d5]' : 'text-[#2c9a9c]'}`} />
                  <div>
                    <p className={`text-xs font-bold ${textPrimary}`}>
                      Sign and log this amendment
                    </p>
                    <p className={`text-[11px] mt-1 leading-relaxed ${textMuted}`}>
                      Signing emits a <code>vendor-renegotiate</code> entry to the action log with the full transcript (prep brief, opening offer, all {draft.rounds.length} round{draft.rounds.length === 1 ? '' : 's'}, final terms). It does NOT update the seeded vendor record — directory sync lands in 4k.2.
                    </p>
                    <p className={`text-[11px] mt-2 ${textMuted}`}>
                      <strong>Vendor:</strong> {vendor.name}<br />
                      <strong>Amendment:</strong> {draft.amendmentRef}<br />
                      <strong>Effective:</strong> {draft.effectiveDate}
                    </p>
                  </div>
                </div>
              </section>
            </>
          )}
        </div>

        {/* Footer */}
        <div className={`shrink-0 flex items-center justify-between gap-3 p-4 border-t ${panelBorder}`}>
          <div className={`text-[10px] ${textMuted}`}>
            {step === 5
              ? allValid
                ? 'Ready to sign · click below to log the amendment'
                : 'Fill the prep, opening, and final terms before signing.'
              : currentValid ? 'Ready · click Next'
                             : 'Fill required fields (marked *) to continue.'}
          </div>
          <div className="flex items-center gap-2">
            {step > 1 && (
              <Button variant="outline" onClick={() => setStep((step - 1) as 1 | 2 | 3 | 4 | 5)}
                      className={isDark ? 'bg-transparent border-gray-700 text-gray-300 hover:bg-gray-800' : ''}>
                <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Back
              </Button>
            )}
            {step < 5 && (
              <Button onClick={() => setStep((step + 1) as 1 | 2 | 3 | 4 | 5)} disabled={!currentValid}
                      className="bg-[#4bbcbe] hover:bg-[#2c9a9c] text-white disabled:opacity-40 disabled:cursor-not-allowed">
                Next <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            )}
            {step === 5 && (
              <Button onClick={handleSubmit} disabled={!allValid}
                      className="bg-[#4bbcbe] hover:bg-[#2c9a9c] text-white disabled:opacity-40 disabled:cursor-not-allowed">
                <Send className="h-3.5 w-3.5 mr-1.5" /> Sign amendment
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
