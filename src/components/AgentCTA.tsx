/**
 * Finn's — AgentCTA (Phase 6 simplification)
 *
 * Mode-aware wrapper for agent-authored reasoning. Two states:
 *
 *   manual — Reasoning is shown as INSIGHT (not as a recommendation).
 *            No defer/decline affordances. No "Approve via primary
 *            CTA" hint. The user is the actor on this entity; the
 *            agent's narrative is reference material, not a proposal.
 *   auto   — Reasoning is shown with an "Auto" chip and an optional
 *            execution note ("<agent> will execute on your approval").
 *            The action surface lives elsewhere on the page; this
 *            component only frames the rationale.
 *
 * Insight on Manual entities is intentional — smart features are
 * always on platform-wide; they're UX, not agent actions. Manual
 * just means the user is driving; the agent can still observe and
 * surface useful context.
 *
 * Atlas is never gated and is NOT this component.
 *
 * Migration notes (from the 3-tier era):
 *   • "Off" cards (amber "Agents are off" message) — removed. The
 *     equivalent in the new model is just "Manual mode with no
 *     reasoning available", which is silent rather than amber.
 *   • "Assist" mode (Suggestion chip + Defer/Decline) — removed.
 *     Those felt like Manual + insight, which is now the Manual
 *     default. Defer / Decline never had real handlers (always
 *     toast stubs); dropping them is a net code cleanup too.
 */

import { Zap } from 'lucide-react';
import { useAutonomyMode, type AutonomyMode } from '../lib/autonomy';

interface AgentCTAProps {
  /** Display label for the agent: e.g. "A-04 (Spend Watchdog)". */
  agentLabel: string;
  /** The agent's plain-English reasoning. */
  reasoning: string;
  /** Dark-mode flag. */
  isDark?: boolean;
  /**
   * Layout variant:
   *   'card'   (default) — header + inset card; for stand-alone surfaces.
   *   'inline'           — minimal chrome (label + reasoning); for
   *                        embedding inside a host page's existing card
   *                        frame.
   */
  variant?: 'card' | 'inline';
  /** Outer wrapper className. Component does NOT own outer padding. */
  className?: string;
  /**
   * Per-entity autonomy override. Pages with their own labor switch
   * (Orders, Inventory, Suppliers) should pass the entity's value
   * so this card reflects the entity's actual setting, not the system
   * default. Defaults to the system default if omitted.
   */
  forceMode?: AutonomyMode;
  /**
   * Auto-mode subtitle below the reasoning.
   * Defaults to "<agent> will execute on your approval".
   */
  autoExecutionNote?: string;
}

export function AgentCTA({
  agentLabel,
  reasoning,
  isDark = false,
  variant = 'card',
  className,
  forceMode,
  autoExecutionNote,
}: AgentCTAProps) {
  const systemMode = useAutonomyMode();
  const mode: AutonomyMode = forceMode ?? systemMode;
  const isAuto = mode === 'auto';

  // ── Inline variant ──
  if (variant === 'inline') {
    return (
      <div className={className}>
        <p className={`text-[10px] font-semibold mb-0.5 ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}>
          {agentLabel}
          <span className={`ml-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full align-middle ${
            isAuto
              ? isDark ? 'bg-[#87986a]/15 text-[#a3b085]' : 'bg-[#f4f6f0] text-[#6b7a54]'
              : isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-600'
          }`}>
            {isAuto ? 'Auto' : 'Insight'}
          </span>
        </p>
        <p className={`text-[11px] leading-relaxed ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
          {reasoning}
        </p>
        {isAuto && (
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
          {isAuto ? 'Agent reasoning' : 'Agent insight'}
        </span>
        <span className={`ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
          isAuto
            ? isDark ? 'bg-[#87986a]/15 text-[#a3b085]' : 'bg-[#f4f6f0] text-[#6b7a54]'
            : isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-600'
        }`}>
          {isAuto ? 'Auto' : 'Manual'}
        </span>
      </div>
      <div className={`p-3 rounded-lg border ${isDark ? 'bg-[#87986a]/5 border-[#87986a]/15' : 'bg-[#f4f6f0] border-[#dbe3ce]'}`}>
        <p className={`text-[10px] font-semibold mb-1 ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}>
          {agentLabel}
        </p>
        <p className={`text-xs leading-relaxed ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
          {reasoning}
        </p>
      </div>
      {isAuto && (
        <p className={`text-[10px] mt-2 px-1 ${isDark ? 'text-[#a3b085]/80' : 'text-[#6b7a54]/80'}`}>
          {autoExecutionNote ?? `${agentLabel} will execute on your approval.`}
        </p>
      )}
    </div>
  );
}
