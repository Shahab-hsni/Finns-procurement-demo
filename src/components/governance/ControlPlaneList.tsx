import { Shield, DollarSign, Eye, FlaskConical } from 'lucide-react';
import { InfoTooltip } from '../ui/InfoTooltip';
import { controlPlanes } from '../../lib/mockData';
import { theme } from '../../lib/theme';

interface ControlPlaneListProps {
  isDark: boolean;
  selectedId: string | null;
  onSelectId: (id: string) => void;
}

const CP_ICONS: Record<string, typeof Shield> = {
  'CP-POL': Shield,
  'CP-ECO': DollarSign,
  'CP-TRU': Eye,
  'CP-SIM': FlaskConical,
};

const CP_PLAIN_LABELS: Record<string, string> = {
  'CP-POL': 'Rules the AI must always follow — spend limits, approval chains, compliance',
  'CP-ECO': 'Monitors budgets, ROI thresholds, and unusual cost spikes',
  'CP-TRU': 'Tracks how trustworthy each agent, supplier, and transaction is',
  'CP-SIM': 'Tests AI decisions safely in a sandbox before they go live',
};

const STATUS_BADGE: Record<string, { dark: string; light: string }> = {
  active:  { dark: 'bg-green-500/15 text-green-400', light: 'bg-green-50 text-green-700' },
  warning: { dark: 'bg-amber-500/15 text-amber-400', light: 'bg-amber-50 text-amber-700' },
  disabled:{ dark: 'bg-red-500/15 text-red-400',     light: 'bg-red-50 text-red-700'     },
};

export function ControlPlaneList({ isDark, selectedId, onSelectId }: ControlPlaneListProps) {
  const t = theme(isDark);

  return (
    <div className="flex flex-col h-full">
      <div className={t.section}>
        <h2 className={`text-sm font-semibold flex items-center gap-1.5 ${t.textPrimary}`}>
          Governance
          <InfoTooltip
            text="Four sets of rules your AI must follow. Click any card to see what that supervisor is currently enforcing."
            isDark={isDark}
            side="bottom"
          />
        </h2>
      </div>

      <div className="flex-1 overflow-auto px-4 py-4 space-y-2">
        {controlPlanes.map((cp) => {
          const Icon = CP_ICONS[cp.id] || Shield;
          const isSelected = selectedId === cp.id;
          const badge = STATUS_BADGE[cp.status];
          return (
            <button
              key={cp.id}
              onClick={() => onSelectId(cp.id)}
              className={`w-full text-left p-3 rounded-lg border transition-colors ${
                isSelected
                  ? isDark ? 'bg-[#87986a]/15 border-[#87986a]/30' : 'bg-[#f4f6f0] border-[#87986a]/30'
                  : isDark ? 'bg-[#2a2a2a] border-gray-800 hover:bg-gray-800' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <Icon className={`h-4 w-4 shrink-0 ${isSelected ? (isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]') : t.textSecondary}`} />
                <span className={`text-xs font-semibold flex-1 min-w-0 truncate ${t.textPrimary}`}>{cp.name}</span>
                <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] ${isDark ? badge.dark : badge.light}`}>
                  {cp.status}
                </span>
              </div>

              <p className={`text-[10px] mb-2 leading-relaxed ${t.textMuted}`}>
                {CP_PLAIN_LABELS[cp.id]}
              </p>

              <div className="flex items-center justify-between mb-1.5">
                <span className={`text-[10px] ${t.textMuted}`}>{cp.ruleCount} rules</span>
                <span className={`text-[10px] font-semibold ${
                  cp.coverage >= 90
                    ? isDark ? 'text-green-400' : 'text-green-600'
                    : cp.coverage >= 70
                      ? isDark ? 'text-amber-400' : 'text-amber-600'
                      : isDark ? 'text-red-400' : 'text-red-600'
                }`}>{cp.coverage}% coverage</span>
              </div>

              <div className={`h-1 rounded-full ${t.progressTrack}`}>
                <div
                  className={`h-1 rounded-full ${
                    cp.coverage >= 90 ? 'bg-green-500' : cp.coverage >= 70 ? 'bg-amber-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${cp.coverage}%` }}
                />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
