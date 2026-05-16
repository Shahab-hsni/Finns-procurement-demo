import { useState } from 'react';
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';
import { TrendingUp, TrendingDown, Minus, SlidersHorizontal } from 'lucide-react';
import { transformationMetrics } from '../../lib/mockData';
import { useSimulatedMetric } from '../../hooks/useSimulatedMetric';
import { theme } from '../../lib/theme';
import { InfoTooltip } from '../ui/InfoTooltip';

interface SparklineHistoriesProps {
  isDark: boolean;
  selectedMetricId: string | null;
  onAuditMetric?: (id: string | null) => void;
  sensitivity?: number;
  onSensitivityChange?: (v: number) => void;
}

const COLORS = ['#87986a', '#60a5fa', '#a78bfa', '#f59e0b', '#34d399', '#fb923c', '#f472b6', '#38bdf8'];

const TREND_ICON = { up: TrendingUp, down: TrendingDown, flat: Minus };

const METRIC_TOOLTIPS: Record<string, string> = {
  'TM-01': 'AI makes this % of your purchases without asking for approval. Higher = less manual work for your team.',
  'TM-02': 'This % of orders run start-to-finish without anyone touching them. Higher = system is working well.',
  'TM-03': 'Manual steps your team no longer needs to do — keeps growing as the AI learns your patterns.',
  'TM-04': 'Staff hours freed from repetitive purchasing work this month. Higher = more time for valuable work.',
  'TM-05': 'Times an item ran out before a new order arrived. Lower is better — zero means no kitchen disruptions.',
  'TM-06': "Money saved vs. what you'd pay without AI-negotiated pricing and bulk timing. Higher = better ROI.",
  'TM-07': 'Cash currently tied up in unpaid invoices and pending orders. Lower = better cash flow.',
  'TM-08': 'Issues flagged that need a human decision. Lower means the system is improving and self-correcting.',
};

type TimeRange = '7D' | '30D' | '90D' | '1Y';

function LiveMetricCard({
  metric, color, isDark, isSelected, onClick, sensitivity, onSensitivityChange,
}: {
  metric: typeof transformationMetrics[0];
  color: string;
  isDark: boolean;
  isSelected: boolean;
  onClick: () => void;
  sensitivity?: number;
  onSensitivityChange?: (v: number) => void;
}) {
  const t = theme(isDark);
  const liveValue = useSimulatedMetric(metric.currentValue);
  const TrendIcon = TREND_ICON[metric.trend];
  const isExceptionTrend = metric.id === 'TM-08';

  return (
    <div
      id={isExceptionTrend ? 'tm-tm08-card' : undefined}
      onClick={onClick}
      className={`cursor-pointer transition-all ${t.cardBorder} ${
        isSelected
          ? isDark ? 'ring-2 ring-[#87986a]/60 bg-[#87986a]/5' : 'ring-2 ring-[#87986a]/50 bg-[#f4f6f0]'
          : isDark ? 'hover:ring-1 hover:ring-[#87986a]/30' : 'hover:ring-1 hover:ring-[#87986a]/30'
      }`}
    >
      {/* Name + trend + tooltip */}
      <div className="flex items-center gap-1 mb-1">
        <span className={`text-[10px] font-semibold flex-1 min-w-0 truncate ${t.textMuted}`}>{metric.name}</span>
        <InfoTooltip text={METRIC_TOOLTIPS[metric.id] ?? metric.name} isDark={isDark} side="top" />
        <div className={`flex items-center gap-0.5 ml-1 shrink-0 ${
          metric.trend === 'up' ? 'text-green-400' : metric.trend === 'down' ? 'text-red-400' : t.textMuted
        }`}>
          <TrendIcon className="h-3 w-3" />
          <span className="text-[10px]">{metric.trendPct}%</span>
        </div>
      </div>

      {/* Value */}
      <span className={`text-lg font-bold ${t.textPrimary}`}>
        {metric.unit === '$' ? '$' : ''}{Math.round(liveValue).toLocaleString()}{metric.unit !== '$' ? metric.unit : ''}
      </span>

      {/* Sparkline */}
      <div className="h-10 mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={metric.history}>
            <Tooltip
              contentStyle={{
                background: isDark ? '#2a2a2a' : '#fff',
                border: isDark ? '1px solid #333' : '1px solid #e5e7eb',
                borderRadius: '6px',
                fontSize: '10px',
                color: isDark ? '#fff' : '#111',
              }}
              formatter={(value: number) => [`${value}${metric.unit}`, metric.name]}
              labelFormatter={(label) => label}
            />
            <Line type="monotone" dataKey="value" stroke={color} strokeWidth={1.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Selected indicator */}
      {isSelected && (
        <div className={`mt-1.5 pt-1.5 border-t text-[9px] flex items-center gap-1 font-semibold ${
          isDark ? 'border-[#87986a]/20 text-[#a3b085]' : 'border-[#dbe3ce] text-[#6b7a54]'
        }`}>
          ↓ See what drove this number
        </div>
      )}

      {/* TM-08 sensitivity slider */}
      {isExceptionTrend && sensitivity !== undefined && onSensitivityChange && (
        <div
          className={`mt-2 pt-2 border-t ${isDark ? 'border-gray-700/50' : 'border-gray-200'}`}
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-1">
            <span className={`text-[9px] flex items-center gap-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
              <SlidersHorizontal className="h-2.5 w-2.5" />
              How many issues to flag?
            </span>
            <span className={`text-[9px] font-bold ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}>
              {sensitivity < 35 ? 'Catch Everything' : sensitivity > 65 ? 'Only Major Issues' : 'Balanced'}
            </span>
          </div>
          <input
            type="range" min={0} max={100} value={sensitivity}
            onChange={e => onSensitivityChange(Number(e.target.value))}
            className="w-full h-1 cursor-pointer accent-[#87986a]"
          />
          <div className="flex justify-between mt-0.5">
            <span className={`text-[8px] ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>Catch everything</span>
            <span className={`text-[8px] ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>Only major issues</span>
          </div>
        </div>
      )}
    </div>
  );
}

export function SparklineHistories({
  isDark, selectedMetricId, onAuditMetric, sensitivity, onSensitivityChange,
}: SparklineHistoriesProps) {
  const t = theme(isDark);
  const [timeRange, setTimeRange] = useState<TimeRange>('30D');
  const ranges: TimeRange[] = ['7D', '30D', '90D', '1Y'];

  return (
    <div id="tm-metrics-section">
      {/* Section header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <h3 className={`text-xs font-semibold ${t.textSecondary}`}>PERFORMANCE METRICS</h3>
          <InfoTooltip
            isDark={isDark}
            side="right"
            text="8 live numbers tracking your AI purchasing system. Click any card to see which AI agents drove the change and what they did."
          />
        </div>
        <div className="flex gap-1">
          {ranges.map((r) => (
            <button
              key={r}
              onClick={() => setTimeRange(r)}
              className={`px-2.5 py-1 rounded-full text-[10px] transition-colors ${
                timeRange === r
                  ? 'bg-[#87986a] text-white'
                  : isDark ? 'bg-[#2a2a2a] text-gray-400 hover:text-gray-200' : 'bg-gray-100 text-gray-500 hover:text-gray-700'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {transformationMetrics.map((metric, i) => (
          <LiveMetricCard
            key={metric.id}
            metric={metric}
            color={COLORS[i]}
            isDark={isDark}
            isSelected={selectedMetricId === metric.id}
            onClick={() => onAuditMetric?.(selectedMetricId === metric.id ? null : metric.id)}
            sensitivity={metric.id === 'TM-08' ? sensitivity : undefined}
            onSensitivityChange={metric.id === 'TM-08' ? onSensitivityChange : undefined}
          />
        ))}
      </div>
    </div>
  );
}
