import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { transformationMetrics } from '../../lib/mockData';
import { theme } from '../../lib/theme';
import { InfoTooltip } from '../ui/InfoTooltip';

interface MetricCategoryListProps {
  isDark: boolean;
  selectedMetric: string | null;
  onSelectMetric: (id: string) => void;
}

const TREND_ICON = { up: TrendingUp, down: TrendingDown, flat: Minus };

const METRIC_PLAIN_LABELS: Record<string, string> = {
  'TM-01': 'AI buys this % without asking you',
  'TM-02': 'Orders handled fully automatically',
  'TM-03': 'Manual tasks eliminated this cycle',
  'TM-04': 'Staff hours freed by automation',
  'TM-05': 'Items that ran out (lower = better)',
  'TM-06': 'Money saved through AI pricing',
  'TM-07': 'Cash tied up in pending orders',
  'TM-08': 'Issues needing your attention',
};

const METRIC_TOOLTIPS: Record<string, string> = {
  'TM-01': 'The % of your purchases the AI makes independently, without needing your sign-off. Higher means more of your time is freed up.',
  'TM-02': 'Of all orders placed, this % completed without a human touching them at any step.',
  'TM-03': 'Every time the AI does something a person used to do manually — approve, search, email a supplier — this counter goes up.',
  'TM-04': 'Total hours your procurement team no longer spends on routine tasks because the AI handles them.',
  'TM-05': 'How many times a product ran out before the system reordered it in time. Zero is the goal.',
  'TM-06': 'The real money saved — AI negotiates better prices and times bulk orders to hit discount windows.',
  'TM-07': 'Cash your business has tied up right now in orders that haven\'t been paid or delivered yet.',
  'TM-08': 'Cases where the AI flagged something it couldn\'t decide alone and needs your input. Fewer = system is getting smarter.',
};

export function MetricCategoryList({ isDark, selectedMetric, onSelectMetric }: MetricCategoryListProps) {
  const t = theme(isDark);

  return (
    <div id="tm-left-panel" className="flex flex-col h-full">
      <div className={t.section}>
        <div className="flex items-center gap-1.5">
          <h2 className={`text-sm font-semibold ${t.textPrimary}`}>Performance Areas</h2>
          <InfoTooltip
            isDark={isDark}
            side="right"
            text="Select a metric to see the AI agents behind it and what actions they took. Click any item to explore further in the main view."
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto px-4 pb-4 space-y-2 pt-2">
        {transformationMetrics.map((metric) => {
          const TrendIcon = TREND_ICON[metric.trend];
          const isSelected = selectedMetric === metric.id;
          const trendColor = metric.trend === 'up'
            ? 'text-green-400'
            : metric.trend === 'down'
              ? 'text-red-400'
              : t.textMuted;

          return (
            <button
              key={metric.id}
              onClick={() => onSelectMetric(metric.id)}
              className={`w-full text-left p-3 rounded-lg border transition-colors ${
                isSelected
                  ? isDark ? 'bg-[#87986a]/15 border-[#87986a]/30' : 'bg-[#f4f6f0] border-[#87986a]/30'
                  : isDark ? 'bg-[#2a2a2a] border-gray-800 hover:bg-gray-800' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
              }`}
            >
              {/* Name + tooltip + trend */}
              <div className="flex items-center gap-1 mb-0.5">
                <span className={`text-xs font-semibold flex-1 min-w-0 truncate ${t.textPrimary}`}>{metric.name}</span>
                <InfoTooltip
                  text={METRIC_TOOLTIPS[metric.id] ?? metric.name}
                  isDark={isDark}
                  side="right"
                />
                <div className={`flex items-center gap-0.5 ml-1 shrink-0 ${trendColor}`}>
                  <TrendIcon className="h-3 w-3" />
                  <span className="text-[10px]">{metric.trendPct}%</span>
                </div>
              </div>

              {/* Plain label */}
              <p className={`text-[10px] mb-1.5 ${t.textMuted}`}>{METRIC_PLAIN_LABELS[metric.id]}</p>

              <div className="flex items-end justify-between">
                <span className={`text-lg font-bold ${t.textPrimary}`}>
                  {metric.unit === '$' ? '$' : ''}{metric.currentValue.toLocaleString()}{metric.unit !== '$' ? metric.unit : ''}
                </span>
                <div className="w-16 h-6">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={metric.history.slice(-8)}>
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke={isSelected ? '#87986a' : isDark ? '#555' : '#ccc'}
                        strokeWidth={1.5}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
