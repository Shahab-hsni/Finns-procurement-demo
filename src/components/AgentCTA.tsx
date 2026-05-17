/**
 * Finn's — AgentCTA / AgentRecommendation
 *
 * Mode-aware wrapper for agent-authored recommendations. Renders
 * differently in Off / Assist / Auto:
 *
 *   off    — Agent reasoning is suppressed. The component renders
 *            a muted "Agents are off" note (or a manual-fallback
 *            affordance if provided). The primary CTA elsewhere on
 *            the page is still active — the user drives the action
 *            from their own judgement using the raw data, not the
 *            agent's narrative.
 *   assist — Agent reasoning + author label render as today. A row
 *            of Defer / Decline links appears below if the handlers
 *            are supplied. The primary CTA elsewhere on the page is
 *            framed as approving the recommendation.
 *   auto   — Agent reasoning + author label render as today. An
 *            "<agent> will execute on your approval" badge appears
 *            below to make it clear that hitting the primary CTA
 *            is delegated execution, not raw admin action.
 *
 * This component does NOT own the primary CTA itself — that stays
 * inline with the rest of the page's action toolbar. It only owns
 * the agent reasoning card + the secondary affordances (Defer /
 * Decline / auto-execution badge).
 *
 * Atlas is never gated — Atlas chat surfaces are NOT this component.
 */

import { Zap, Hand } from 'lucide-react';
import { useAutonomyMode } from '../lib/autonomy';

interface AgentCTAProps {
  /** Display label for the agent: e.g. "A-04 (Spend Watchdog)". */
  agentLabel: string;
  /** The agent's plain-English reasoning for the recommendation. */
  reasoning: string;
  /** Optional dark-mode flag (defaults to false for explicit theming). */
  isDark?: boolean;
  /**
   * Layout variant:
   *   'card'   (default) — full header + inset card; for stand-alone surfaces.
   *   'inline'           — minimal chrome (label + reasoning + actions); for
   *                        embedding inside a host page's existing card frame
   *                        (e.g. Suppliers' "Agent Intelligence" panel) or
   *                        a compact list-row snippet.
   */
  variant?: 'card' | 'inline';
  /**
   * Outer wrapper className. The component does NOT own a default outer
   * padding / border — pass whatever fits the surrounding layout.
   */
  className?: string;
  /**
   * Assist-mode handler for "Defer" — snooze the recommendation.
   * If omitted, the Defer link is not rendered.
   */
  onDefer?: () => void;
  /**
   * Assist-mode handler for "Decline" — reject the recommendation.
   * If omitted, the Decline link is not rendered.
   */
  onDecline?: () => void;
  /**
   * Auto-mode subtitle that appears below the reasoning.
   * Defaults to "<agent> will execute on your approval".
   */
  autoExecutionNote?: string;
  /**
   * Off-mode replacement copy. Defaults to a generic "Agents are off"
   * card. Provide a domain-specific message for better context.
   */
  offModeMessage?: string;
}

export function AgentCTA({
  agentLabel,
  reasoning,
  isDark = false,
  variant = 'card',
  className,
  onDefer,
  onDecline,
  autoExecutionNote,
  offModeMessage,
}: AgentCTAProps) {
  const mode = useAutonomyMode();

  // ── Off mode: suppress agent narrative, surface manual framing ──
  if (mode === 'off') {
    if (variant === 'inline') {
      return (
        <div className={`flex items-start gap-2 ${className ?? ''}`}>
          <Hand className={`h-3 w-3 mt-0.5 shrink-0 ${isDark ? 'text-amber-300' : 'text-amber-700'}`} />
          <p className={`text-[10px] leading-relaxed ${isDark ? 'text-amber-300/90' : 'text-amber-700'}`}>
            <span className="font-semibold">Agents are off — </span>
            {offModeMessage ?? 'Use the data above and the primary action to drive this manually. Agent reasoning is hidden.'}
          </p>
        </div>
      );
    }
    return (
      <div className={className}>
        <div className="flex items-center gap-2 mb-2">
          <Hand className={`h-3.5 w-3.5 ${isDark ? 'text-amber-300' : 'text-amber-700'}`} />
          <span className={`text-[10px] font-semibold uppercase tracking-wide ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>
            Manual review
          </span>
        </div>
        <div className={`p-3 rounded-lg border ${isDark ? 'bg-amber-500/5 border-amber-500/20' : 'bg-amber-50/70 border-amber-200/70'}`}>
          <p className={`text-[10px] font-semibold mb-1 ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>
            Agents are off
          </p>
          <p className={`text-xs leading-relaxed ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
            {offModeMessage ?? 'Approve or decline based on the order data above. Agent reasoning is hidden because the operating agents are observing only.'}
          </p>
        </div>
      </div>
    );
  }

  // ── Assist / Auto: render reasoning + mode-specific affordances ──
  const showDeferDecline = mode === 'assist' && (onDefer || onDecline);
  const showAutoBadge    = mode === 'auto';

  // ── Inline variant: minimal chrome, no header — for places like
  // Inventory's compact reasoning snippet or Suppliers' existing
  // "Agent Intelligence" wrapper that already owns the framing.
  if (variant === 'inline') {
    return (
      <div className={className}>
        <p className={`text-[10px] font-semibold mb-0.5 ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}>
          {agentLabel}
          {mode === 'assist' && (
            <span className={`ml-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full align-middle ${isDark ? 'bg-blue-500/15 text-blue-300' : 'bg-blue-50 text-blue-700'}`}>
              Suggestion
            </span>
          )}
          {mode === 'auto' && (
            <span className={`ml-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full align-middle ${isDark ? 'bg-[#87986a]/15 text-[#a3b085]' : 'bg-[#f4f6f0] text-[#6b7a54]'}`}>
              Auto
            </span>
          )}
        </p>
        <p className={`text-[11px] leading-relaxed ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
          {reasoning}
        </p>
        {showDeferDecline && (
          <div className="flex items-center gap-3 mt-1.5">
            {onDefer && (
              <button onClick={onDefer}
                className={`text-[10px] font-semibold transition-colors ${isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-800'}`}>
                Defer
              </button>
            )}
            {onDefer && onDecline && (
              <span className={`text-[10px] ${isDark ? 'text-gray-700' : 'text-gray-300'}`}>·</span>
            )}
            {onDecline && (
              <button onClick={onDecline}
                className={`text-[10px] font-semibold transition-colors ${isDark ? 'text-red-400 hover:text-red-300' : 'text-red-600 hover:text-red-700'}`}>
                Decline
              </button>
            )}
          </div>
        )}
        {showAutoBadge && (
          <p className={`text-[9px] mt-1 ${isDark ? 'text-[#a3b085]/80' : 'text-[#6b7a54]/80'}`}>
            {autoExecutionNote ?? `${agentLabel} will execute on your approval.`}
          </p>
        )}
      </div>
    );
  }

  // ── Default 'card' variant ──
  return (
    <div className={className}>
      <div className="flex items-center gap-2 mb-2">
        <Zap className={`h-3.5 w-3.5 ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`} />
        <span className={`text-[10px] font-semibold uppercase tracking-wide ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          Agent reasoning
        </span>
        {mode === 'assist' && (
          <span className={`ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full ${isDark ? 'bg-blue-500/15 text-blue-300' : 'bg-blue-50 text-blue-700'}`}>
            Recommendation
          </span>
        )}
        {mode === 'auto' && (
          <span className={`ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full ${isDark ? 'bg-[#87986a]/15 text-[#a3b085]' : 'bg-[#f4f6f0] text-[#6b7a54]'}`}>
            Auto-mode
          </span>
        )}
      </div>
      <div className={`p-3 rounded-lg border ${isDark ? 'bg-[#87986a]/5 border-[#87986a]/15' : 'bg-[#f4f6f0] border-[#dbe3ce]'}`}>
        <p className={`text-[10px] font-semibold mb-1 ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}>
          {agentLabel}
        </p>
        <p className={`text-xs leading-relaxed ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
          {reasoning}
        </p>
      </div>

      {showDeferDecline && (
        <div className="flex items-center gap-3 mt-2 px-1">
          {onDefer && (
            <button onClick={onDefer}
              className={`text-[10px] font-semibold transition-colors ${isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-800'}`}>
              Defer
            </button>
          )}
          {onDefer && onDecline && (
            <span className={`text-[10px] ${isDark ? 'text-gray-700' : 'text-gray-300'}`}>·</span>
          )}
          {onDecline && (
            <button onClick={onDecline}
              className={`text-[10px] font-semibold transition-colors ${isDark ? 'text-red-400 hover:text-red-300' : 'text-red-600 hover:text-red-700'}`}>
              Decline
            </button>
          )}
          <span className={`ml-auto text-[9px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            Approve via primary CTA
          </span>
        </div>
      )}

      {showAutoBadge && (
        <p className={`text-[10px] mt-2 px-1 ${isDark ? 'text-[#a3b085]/80' : 'text-[#6b7a54]/80'}`}>
          {autoExecutionNote ?? `${agentLabel} will execute on your approval.`}
        </p>
      )}
    </div>
  );
}
