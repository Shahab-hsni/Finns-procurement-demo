import { CheckCircle, Clock, XCircle, RotateCcw, ExternalLink, Scale } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { decisionRecords } from '../../lib/mockData';
import { theme } from '../../lib/theme';

interface DecisionLedgerProps {
  isDark: boolean;
  activeLossCategory?: string | null;
  hardenedDecisions?: Set<string>;
  onOpenReasoningChain?: (decisionId: string) => void;
  /** When set, the matching row gets a brief flash + scroll-into-view.
   *  Driven by the page's hash-reader for `#decision=DEC-XXX` deep-links. */
  highlightDecisionId?: string | null;
}

const OUTCOME_BADGE: Record<string, { icon: typeof CheckCircle; dark: string; light: string }> = {
  success:    { icon: CheckCircle, dark: 'text-green-400',  light: 'text-green-600'  },
  pending:    { icon: Clock,       dark: 'text-amber-400',  light: 'text-amber-600'  },
  failed:     { icon: XCircle,     dark: 'text-red-400',    light: 'text-red-600'    },
  overridden: { icon: RotateCcw,   dark: 'text-purple-400', light: 'text-purple-600' },
};

// Loss category → responsible agent IDs (derived from incident types)
const LOSS_CATEGORY_AGENTS: Record<string, string[]> = {
  'LC-FRD': ['GOV-005'],               // Fraud detection
  'LC-WST': ['REA-004', 'EXE-006'],    // Price optimization + auto-reorder
  'LC-ERR': ['SEN-003', 'EXE-001'],    // Demand classification + PO generation
  'LC-DLY': ['EXE-003', 'MET-001'],    // Payment processing + agent scaling
  'LC-NCO': ['GOV-002'],               // Budget enforcement
};

export function DecisionLedger({
  isDark, activeLossCategory, hardenedDecisions, onOpenReasoningChain, highlightDecisionId,
}: DecisionLedgerProps) {
  const t = theme(isDark);

  const visibleRecords = activeLossCategory
    ? decisionRecords.filter(dr => (LOSS_CATEGORY_AGENTS[activeLossCategory] ?? []).includes(dr.agentId))
    : decisionRecords;

  const handleActivityDeepLink = (decisionId: string) => {
    window.dispatchEvent(new CustomEvent('buyamia-navigate-page', { detail: { page: 'ai-activity', decisionId } }));
  };

  return (
    <div>
      <style>{`
        @keyframes flash-row {
          0%   { background-color: rgba(135,152,106,0.45); }
          40%  { background-color: rgba(135,152,106,0.25); }
          100% { background-color: rgba(135,152,106,0); }
        }
      `}</style>
      {activeLossCategory && (
        <p className={`text-[10px] mb-2 ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}>
          Showing {visibleRecords.length} decision{visibleRecords.length !== 1 ? 's' : ''} linked to this loss category
        </p>
      )}
      <div className={`${t.cardPanel} overflow-hidden`}>
        <table className="w-full text-xs">
          <thead>
            <tr className={isDark ? 'border-b border-gray-800' : 'border-b border-gray-200'}>
              <th className={`text-left py-2 px-3 font-medium ${t.textSecondary}`}>Time</th>
              <th className={`text-left py-2 px-3 font-medium ${t.textSecondary}`}>
                Agent
                <span className={`ml-1 text-[9px] font-normal ${t.textMuted}`}>(click for chain)</span>
              </th>
              <th className={`text-left py-2 px-3 font-medium ${t.textSecondary}`}>Decision</th>
              <th className={`text-center py-2 px-3 font-medium ${t.textSecondary}`}>Confidence</th>
              <th className={`text-center py-2 px-3 font-medium ${t.textSecondary}`}>Level</th>
              <th className={`text-center py-2 px-3 font-medium ${t.textSecondary}`}>Outcome</th>
              <th className={`text-right py-2 px-3 font-medium ${t.textSecondary}`}>Action</th>
            </tr>
          </thead>
          <tbody>
            {visibleRecords.map((dr) => {
              const isHardened = hardenedDecisions?.has(dr.id);
              const outcome = OUTCOME_BADGE[dr.outcome];
              const OutcomeIcon = outcome.icon;
              const isHighlighted = highlightDecisionId === dr.id;
              return (
                <tr key={dr.id}
                  data-decision-id={dr.id}
                  className={`${isDark ? 'border-b border-gray-800/50' : 'border-b border-gray-100'} ${
                    isHighlighted
                      ? isDark ? 'bg-[#87986a]/15 ring-1 ring-[#87986a]/40' : 'bg-[#f4f6f0] ring-1 ring-[#87986a]/40'
                      : ''
                  }`}
                  style={isHighlighted ? { animation: 'flash-row 2200ms ease-out' } : undefined}>
                  <td className={`py-2.5 px-3 ${t.textMuted}`}>{dr.timestamp}</td>

                  {/* Agent — clickable → Reasoning Chain */}
                  <td className="py-2.5 px-3">
                    <button
                      onClick={() => onOpenReasoningChain?.(dr.id)}
                      className={`font-medium transition-colors underline underline-offset-2 decoration-dotted ${
                        isDark
                          ? 'text-[#a3b085] hover:text-[#c8d4a8]'
                          : 'text-[#6b7a54] hover:text-[#4a5a38]'
                      }`}
                      title="Open reasoning chain for this decision"
                    >
                      {dr.agentName}
                    </button>
                  </td>

                  <td className={`py-2.5 px-3 ${t.textPrimary}`}>{dr.decisionType}</td>

                  <td className="py-2.5 px-3 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <div className={`w-8 h-1.5 rounded-full ${t.progressTrack}`}>
                        <div
                          className={`h-1.5 rounded-full ${dr.confidenceScore >= 90 ? 'bg-green-500' : dr.confidenceScore >= 70 ? 'bg-amber-500' : 'bg-red-500'}`}
                          style={{ width: `${dr.confidenceScore}%` }}
                        />
                      </div>
                      <span className={t.textPrimary}>{dr.confidenceScore}%</span>
                    </div>
                  </td>

                  <td className={`py-2.5 px-3 text-center ${t.textMuted}`}>
                    L{dr.autonomyLevel}
                  </td>

                  {/* Outcome — shows ⚖️ Precedent Set when hardened */}
                  <td className="py-2.5 px-3 text-center">
                    {isHardened ? (
                      <div className="flex items-center justify-center gap-1">
                        <Scale className={`h-3.5 w-3.5 ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`} />
                        <span className={`font-semibold text-[11px] ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}>
                          Precedent Set
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-1">
                        <OutcomeIcon className={`h-3.5 w-3.5 ${isDark ? outcome.dark : outcome.light}`} />
                        <span className={`capitalize ${isDark ? outcome.dark : outcome.light}`}>{dr.outcome}</span>
                      </div>
                    )}
                  </td>

                  {/* Action column: Override + AI Activity deep link */}
                  <td className="py-2.5 px-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {dr.outcome !== 'overridden' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toast.info(`Override flow — ${dr.id}`, {
                            description: 'Production: captures reason, requires co-signer for L4+ decisions, appends to signed audit log with prev-hash. Reversal scoped by role.',
                          })}
                          className={`h-6 text-[10px] px-2 ${isDark ? 'border-gray-700 text-gray-400 hover:bg-gray-800' : ''}`}
                        >
                          Override
                        </Button>
                      )}
                      <button
                        onClick={() => handleActivityDeepLink(dr.id)}
                        title="View in AI Activity ledger"
                        className={`p-1 rounded transition-colors ${
                          isDark
                            ? 'text-gray-600 hover:text-[#a3b085] hover:bg-[#87986a]/10'
                            : 'text-gray-400 hover:text-[#6b7a54] hover:bg-[#f4f6f0]'
                        }`}
                      >
                        <ExternalLink className="h-3 w-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {activeLossCategory && visibleRecords.length === 0 && (
          <div className={`px-4 py-6 text-center text-xs ${t.textMuted}`}>
            No decisions linked to this loss category
          </div>
        )}
      </div>
    </div>
  );
}
