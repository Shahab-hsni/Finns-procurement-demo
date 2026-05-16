import { ArrowLeft, History } from 'lucide-react';
import type { TrailReturnMarker } from '../lib/trailReturn';

interface TrailReturnPillProps {
  marker: TrailReturnMarker;
  isDark: boolean;
  /** Called when the user clicks the pill. The host should navigate
   *  to the Orders page; the marker stays in sessionStorage so Orders
   *  picks it up and re-opens the Decision Attribution Trail. */
  onReturn: () => void;
}

/**
 * Floating breadcrumb shown on Governance / AI Activity when the user
 * arrived via a Decision Attribution Trail deep-link. Fixed near the
 * top of the viewport (below the top nav) so it stays visible while
 * the user browses the destination page.
 */
export function TrailReturnPill({ marker, isDark, onReturn }: TrailReturnPillProps) {
  return (
    <div className="fixed left-1/2 -translate-x-1/2 z-40" style={{ top: 64 }}>
      <button
        onClick={onReturn}
        title={`Return to the Decision Attribution Trail for ${marker.orderId} at Stage ${marker.stageIdx + 1}`}
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border shadow-lg text-[11px] font-semibold transition-all hover:scale-[1.02] ${
          isDark
            ? 'bg-[#87986a]/15 border-[#87986a]/40 text-[#a3b085] hover:bg-[#87986a]/25'
            : 'bg-white border-[#87986a]/40 text-[#6b7a54] hover:bg-[#f4f6f0]'
        }`}
      >
        <ArrowLeft className="h-3 w-3" />
        <History className="h-3 w-3 opacity-70" />
        <span>Return to {marker.orderId} · Stage {marker.stageIdx + 1} Trail</span>
      </button>
    </div>
  );
}
