import { supplierPromises } from '../../lib/mockData';
import { theme } from '../../lib/theme';
import { InfoTooltip } from '../ui/InfoTooltip';

interface SupplierPromiseEngineProps {
  isDark: boolean;
  pausedSuppliers?: Set<string>;
  onPauseToggle?: (supplierId: string) => void;
  onLogisticsView?: (supplierId: string) => void;
  activeLogisticsId?: string | null;
}

const VARIANCE_BADGE: Record<string, { dark: string; light: string; label: string }> = {
  'on-track': { dark: 'bg-green-500/15 text-green-400',  light: 'bg-green-50 text-green-700',  label: 'On Track' },
  'at-risk':  { dark: 'bg-amber-500/15 text-amber-400',  light: 'bg-amber-50 text-amber-700',  label: 'At Risk'  },
  'breached': { dark: 'bg-red-500/15 text-red-400',      light: 'bg-red-50 text-red-700',      label: 'Breached' },
};

const COLUMN_TIPS = {
  delivery: 'How many days the supplier actually took vs. how many days they promised. Click to see the full order journey.',
  quality:  'The actual product quality score vs. what the supplier guaranteed. Click to see the full order journey.',
  trust:    'A 0–100 reliability score based on this supplier\'s past delivery speed and quality. 80+ is healthy; below 60 means high risk.',
  status:   '"On Track" = keeping all promises. "At Risk" = starting to slip. "Breached" = missed promises — action recommended.',
  autoOrders: 'Whether the AI is currently placing orders with this supplier automatically. Stop Auto-Orders to pause while you investigate an issue.',
};

export function SupplierPromiseEngine({
  isDark, pausedSuppliers = new Set(), onPauseToggle, onLogisticsView, activeLogisticsId,
}: SupplierPromiseEngineProps) {
  const t = theme(isDark);

  return (
    <div id="tm-supplier-section">
      {/* Section header */}
      <div className="flex items-center gap-1.5 mb-3">
        <h3 className={`text-xs font-semibold ${t.textSecondary}`}>SUPPLIER PROMISE TRACKER</h3>
        <InfoTooltip
          isDark={isDark}
          side="right"
          text="Tracks whether your suppliers are keeping their delivery time and quality promises. Click any Delivery or Quality score to trace the full order journey. Stop Auto-Orders to pause AI purchasing from a supplier while you investigate."
        />
      </div>

      <div className={`${t.cardPanel} overflow-hidden`}>
        <table className="w-full text-xs">
          <thead>
            <tr className={isDark ? 'border-b border-gray-800' : 'border-b border-gray-200'}>
              <th className={`text-left py-2 px-3 font-medium ${t.textSecondary}`}>Supplier</th>

              <th className={`text-left py-2 px-3 font-medium ${t.textSecondary}`}>
                <div className="flex items-center gap-1">
                  Delivery
                  <InfoTooltip text={COLUMN_TIPS.delivery} isDark={isDark} side="top" />
                </div>
                <div className={`text-[9px] font-normal mt-0.5 ${t.textMuted}`}>actual / promised</div>
              </th>

              <th className={`text-left py-2 px-3 font-medium ${t.textSecondary}`}>
                <div className="flex items-center gap-1">
                  Quality
                  <InfoTooltip text={COLUMN_TIPS.quality} isDark={isDark} side="top" />
                </div>
                <div className={`text-[9px] font-normal mt-0.5 ${t.textMuted}`}>actual / promised</div>
              </th>

              <th className={`text-center py-2 px-3 font-medium ${t.textSecondary}`}>
                <div className="flex items-center justify-center gap-1">
                  Trust Score
                  <InfoTooltip text={COLUMN_TIPS.trust} isDark={isDark} side="top" />
                </div>
                <div className={`text-[9px] font-normal mt-0.5 ${t.textMuted}`}>out of 100</div>
              </th>

              <th className={`text-right py-2 px-3 font-medium ${t.textSecondary}`}>
                <div className="flex items-center justify-end gap-1">
                  Status
                  <InfoTooltip text={COLUMN_TIPS.status} isDark={isDark} side="top" />
                </div>
              </th>

              <th className={`text-right py-2 px-3 font-medium ${t.textSecondary}`}>
                <div className="flex items-center justify-end gap-1">
                  Auto-Orders
                  <InfoTooltip text={COLUMN_TIPS.autoOrders} isDark={isDark} side="top" />
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {supplierPromises.map((sp) => {
              const badge = VARIANCE_BADGE[sp.variance];
              const isBreached = sp.variance === 'breached';
              const isAtRisk = sp.variance === 'at-risk';
              const isPaused = pausedSuppliers.has(sp.supplierId);
              const isLogisticsOpen = activeLogisticsId === sp.supplierId;

              return (
                <tr
                  key={sp.supplierId}
                  id={sp.supplierId === 'SP-04' ? 'tm-greenharvest-row' : undefined}
                  className={`relative ${isDark ? 'border-b border-gray-800/50' : 'border-b border-gray-100'} ${
                    isBreached
                      ? isDark ? 'bg-amber-500/5 ring-1 ring-inset ring-amber-500/20' : 'bg-amber-50/60 ring-1 ring-inset ring-amber-200'
                      : ''
                  }`}
                >
                  <td className={`py-2.5 px-3 font-medium ${t.textPrimary}`}>
                    <div>{sp.supplierName}</div>
                    {isBreached && (
                      <div className={`text-[9px] font-semibold mt-0.5 ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>
                        ⚠ Missed delivery & quality promises
                      </div>
                    )}
                    {isPaused && (
                      <div className={`text-[9px] mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        AI orders paused
                      </div>
                    )}
                  </td>

                  {/* Delivery — clickable */}
                  <td className="py-2.5 px-3">
                    <button
                      onClick={() => onLogisticsView?.(isLogisticsOpen ? '' : sp.supplierId)}
                      className="text-left transition-colors group"
                      title="Click to see the full delivery journey"
                    >
                      <div className="flex items-baseline gap-1">
                        <span className={`font-semibold text-sm ${
                          isBreached ? (isDark ? 'text-amber-400' : 'text-amber-600') : t.textPrimary
                        }`}>{sp.actualDelivery}</span>
                        <span className={`text-[10px] ${t.textMuted}`}>vs {sp.promisedDelivery}</span>
                      </div>
                      <div className={`text-[9px] underline underline-offset-2 mt-0.5 ${
                        isLogisticsOpen
                          ? isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'
                          : isDark ? 'text-gray-600 group-hover:text-[#a3b085]' : 'text-gray-400 group-hover:text-[#6b7a54]'
                      }`}>View order journey →</div>
                    </button>
                  </td>

                  {/* Quality — clickable */}
                  <td className="py-2.5 px-3">
                    <button
                      onClick={() => onLogisticsView?.(isLogisticsOpen ? '' : sp.supplierId)}
                      className="text-left transition-colors group"
                    >
                      <div className="flex items-baseline gap-1">
                        <span className={`font-semibold text-sm ${
                          isBreached ? (isDark ? 'text-amber-400' : 'text-amber-600') : t.textPrimary
                        }`}>{sp.actualQuality}%</span>
                        <span className={`text-[10px] ${t.textMuted}`}>vs {sp.promisedQuality}%</span>
                      </div>
                    </button>
                  </td>

                  {/* Trust score */}
                  <td className="py-2.5 px-3 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <div className={`w-10 h-1.5 rounded-full ${t.progressTrack}`}>
                        <div
                          className={`h-1.5 rounded-full ${
                            sp.trustScore >= 80 ? 'bg-green-500' : sp.trustScore >= 60 ? 'bg-amber-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${sp.trustScore}%` }}
                        />
                      </div>
                      <span className={`font-bold tabular-nums ${
                        sp.trustScore >= 80 ? (isDark ? 'text-green-400' : 'text-green-600')
                        : sp.trustScore >= 60 ? (isDark ? 'text-amber-400' : 'text-amber-600')
                        : (isDark ? 'text-red-400' : 'text-red-600')
                      }`}>{sp.trustScore}</span>
                    </div>
                    <div className={`text-[9px] mt-0.5 ${t.textMuted}`}>
                      {sp.trustScore >= 80 ? 'Reliable' : sp.trustScore >= 60 ? 'Watch closely' : 'High risk'}
                    </div>
                  </td>

                  {/* Status badge */}
                  <td className="py-2.5 px-3 text-right">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${isDark ? badge.dark : badge.light}`}>
                      {badge.label}
                    </span>
                  </td>

                  {/* Pause/Resume */}
                  <td className="py-2.5 px-3 text-right">
                    {(isBreached || isAtRisk) ? (
                      <button
                        onClick={() => onPauseToggle?.(sp.supplierId)}
                        className={`text-[10px] px-2 py-1 rounded border transition-colors whitespace-nowrap ${
                          isPaused
                            ? isDark ? 'bg-[#87986a]/15 border-[#87986a]/30 text-[#a3b085]' : 'bg-[#f4f6f0] border-[#dbe3ce] text-[#6b7a54]'
                            : isBreached
                              ? isDark ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20' : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
                              : isDark ? 'border-gray-700 text-gray-500 hover:border-amber-500/30 hover:text-amber-400' : 'border-gray-200 text-gray-500 hover:border-amber-200 hover:text-amber-600'
                        }`}
                      >
                        {isPaused ? '▶ Resume Auto-Orders' : '⏸ Stop Auto-Orders'}
                      </button>
                    ) : (
                      <span className={`text-[10px] ${t.textMuted}`}>Active</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Legend */}
        <div className={`px-3 py-2 border-t text-[9px] flex items-center gap-4 ${
          isDark ? 'border-gray-800 text-gray-600' : 'border-gray-100 text-gray-400'
        }`}>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />Reliable (80+)</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />Watch closely (60–79)</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />High risk (below 60)</span>
        </div>
      </div>
    </div>
  );
}
