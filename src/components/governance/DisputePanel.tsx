import { useState } from 'react';
import { AlertTriangle, CheckCircle, XCircle, ArrowUpRight, Scale, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { InfoTooltip } from '../ui/InfoTooltip';
import { disputes } from '../../lib/mockData';
import { theme } from '../../lib/theme';

// Maps a decision ref to the associated PO number in Orders
const DECISION_TO_ORDER: Record<string, string> = {
  'DEC-001': 'PO-4821',
  'DEC-002': 'PO-4798',
  'DEC-003': 'PO-4756',
  'DEC-004': 'PO-4801',
  'DEC-005': 'PO-4812',
  'DEC-006': 'PO-4833',
};

interface DisputePanelProps {
  isDark: boolean;
  hardenedDecisions?: Set<string>;
  onHardenPolicy?: (decisionId: string) => void;
  onNavigate?: (page: string) => void;
}

const STATUS_BADGE: Record<string, { dark: string; light: string }> = {
  open:      { dark: 'bg-red-500/15 text-red-400',      light: 'bg-red-50 text-red-700'      },
  resolved:  { dark: 'bg-green-500/15 text-green-400',  light: 'bg-green-50 text-green-700'  },
  escalated: { dark: 'bg-purple-500/15 text-purple-400',light: 'bg-purple-50 text-purple-700'},
};

const PRIORITY_DOT: Record<string, string> = {
  high:   'bg-red-500',
  medium: 'bg-amber-500',
  low:    'bg-green-500',
};

export function DisputePanel({ isDark, hardenedDecisions, onHardenPolicy, onNavigate }: DisputePanelProps) {
  const t = theme(isDark);
  // Track disputes approved in this session (local UI state)
  const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set());

  const handleApprove = (disputeId: string) => {
    setApprovedIds(prev => new Set([...prev, disputeId]));
  };

  return (
    <div>
      <h3 className={`text-xs font-semibold mb-3 flex items-center gap-1.5 ${t.textSecondary}`}>
        DISPUTES
        <InfoTooltip
          text="Any time you disagree with a decision your AI made, you can push back here. Approve an override, then lock it in as a permanent rule so the AI learns from it."
          isDark={isDark}
          side="top"
        />
      </h3>
      <div className="space-y-3">
        {disputes.map((dispute) => {
          const isApproved = approvedIds.has(dispute.id);
          const isHardened = hardenedDecisions?.has(dispute.decisionId);
          const effectiveStatus = isApproved ? 'resolved' : dispute.status;
          const badge = STATUS_BADGE[effectiveStatus];

          return (
            <div key={dispute.id} className={`${t.cardPanel} ${
              isApproved && !isHardened
                ? isDark ? 'border-[#87986a]/25 ring-1 ring-[#87986a]/15' : 'border-[#87986a]/30'
                : ''
            }`}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className={`h-4 w-4 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />
                  <span className={`text-xs font-medium ${t.textPrimary}`}>{dispute.id}</span>
                  <div className={`w-2 h-2 rounded-full ${PRIORITY_DOT[dispute.priority]}`} />
                  <span className={`text-[10px] capitalize ${t.textMuted}`}>{dispute.priority}</span>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] ${isDark ? badge.dark : badge.light}`}>
                  {effectiveStatus}
                </span>
              </div>

              <p className={`text-xs mb-2 ${t.textSecondary}`}>{dispute.reason}</p>

              <div className="flex items-center justify-between">
                <span className={`text-[10px] ${t.textMuted}`}>
                  Raised by {dispute.raisedBy} · Ref: {dispute.decisionId}
                </span>

                {/* Open dispute: Approve / Reject / Escalate */}
                {dispute.status === 'open' && !isApproved && (
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      className="h-6 text-[10px] px-2 bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => handleApprove(dispute.id)}
                    >
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toast.info(`Reject dispute — ${dispute.id}`, {
                        description: 'Production: captures reason code, notifies raiser via channel of record, opens appeal window with SLA clock, audit-logged with actor + signature.',
                      })}
                      className={`h-6 text-[10px] px-2 ${isDark ? 'border-gray-700 text-gray-400 hover:bg-gray-800' : ''}`}
                    >
                      <XCircle className="h-3 w-3 mr-1" />
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toast.info(`Escalate dispute — ${dispute.id}`, {
                        description: 'Production: routes to assigned reviewer (legal / compliance / ops manager based on priority), opens evidence panel, starts SLA clock with auto-page on breach.',
                      })}
                      className={`h-6 text-[10px] px-2 ${isDark ? 'border-gray-700 text-gray-400 hover:bg-gray-800' : ''}`}
                    >
                      <ArrowUpRight className="h-3 w-3 mr-1" />
                      Escalate
                    </Button>
                  </div>
                )}
              </div>

              {/* Post-approval: Harden Policy handshake + Resume Order */}
              {isApproved && !isHardened && (
                <div className={`mt-3 p-2.5 rounded-lg border ${
                  isDark ? 'bg-[#87986a]/8 border-[#87986a]/25' : 'bg-[#f4f6f0] border-[#dbe3ce]'
                }`}>
                  <p className={`text-[10px] mb-2 leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    This override resolved the dispute. Lock it in as a standing policy rule so the AI won't repeat this decision in the same scenario?
                  </p>
                  <button
                    onClick={() => {
                      onHardenPolicy?.(dispute.decisionId);
                      window.dispatchEvent(new CustomEvent('buyamia-governance-precedent-set', {
                        detail: { decisionId: dispute.decisionId, disputeReason: dispute.reason },
                      }));
                    }}
                    className="w-full py-1.5 rounded text-[11px] font-semibold transition-colors bg-[#87986a] hover:bg-[#6b7a54] text-white"
                  >
                    <Scale className="h-3 w-3 inline mr-1.5" />
                    Harden Policy — Set as Precedent
                  </button>
                  {DECISION_TO_ORDER[dispute.decisionId] && (
                    <button
                      onClick={() => onNavigate?.('orders')}
                      className={`mt-2 w-full py-1.5 rounded text-[11px] font-medium transition-colors flex items-center justify-center gap-1.5 ${
                        isDark
                          ? 'bg-[#2a2a2a] hover:bg-[#333] text-[#a3b085] border border-[#87986a]/30'
                          : 'bg-white hover:bg-gray-50 text-[#6b7a54] border border-[#dbe3ce]'
                      }`}
                    >
                      <ExternalLink className="h-3 w-3" />
                      Resume Order → {DECISION_TO_ORDER[dispute.decisionId]}
                    </button>
                  )}
                </div>
              )}

              {/* Hardened confirmation */}
              {isHardened && (
                <div className={`mt-3 flex items-center gap-2 p-2 rounded-lg ${
                  isDark ? 'bg-[#87986a]/10' : 'bg-[#f4f6f0]'
                }`}>
                  <Scale className={`h-3.5 w-3.5 shrink-0 ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`} />
                  <span className={`text-[10px] font-semibold ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}>
                    ⚖️ Precedent Set — policy hardened for {dispute.decisionId}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
