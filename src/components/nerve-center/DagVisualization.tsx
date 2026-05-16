import { useState, useEffect } from 'react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { X, AlertTriangle, Brain, Thermometer } from 'lucide-react';
import { InfoTooltip } from '../ui/InfoTooltip';
import { dagStages, agents, transformationMetrics, decisionRecords } from '../../lib/mockData';
import { AUTONOMY_LABELS } from '../../lib/types';
import type { AutonomyLevel, DagStage, AgentClass } from '../../lib/types';
import { useHeartbeat } from '../../hooks/useHeartbeat';
import { useSimulatedMetric } from '../../hooks/useSimulatedMetric';
import { theme } from '../../lib/theme';

interface DagVisualizationProps {
  isDark: boolean;
  selectedClass: AgentClass | null;
  autonomyLevel: AutonomyLevel;
  onAutonomyChange: (level: AutonomyLevel) => void;
  systemStress: number;
  anomalyCount: number;
}

// Default system-wide metrics
const SPARKLINE_DEFS = [
  { label: 'Active Agents',    baseline: 34,   unit: '',   color: '#87986a' },
  { label: 'Events/Sec',       baseline: 1240, unit: '/s', color: '#60a5fa' },
  { label: 'Autonomous Spend', baseline: 67,   unit: '%',  color: '#a78bfa' },
  { label: 'Entities',         baseline: 12400,unit: '',   color: '#f59e0b' },
  { label: 'Realized Savings', baseline: 340,  unit: 'K',  color: '#34d399' },
];

// Per-class metrics shown when a class filter is active
const CLASS_METRICS: Record<AgentClass, typeof SPARKLINE_DEFS> = {
  sensing: [
    { label: 'Signals/Min',  baseline: 342,  unit: '/m', color: '#60a5fa' },
    { label: 'Feed Latency', baseline: 180,  unit: 'ms', color: '#f59e0b' },
    { label: 'SEN Active',   baseline: 7,    unit: '',   color: '#87986a' },
    { label: 'Accuracy',     baseline: 94,   unit: '%',  color: '#34d399' },
    { label: 'Anomalies',    baseline: 12,   unit: '',   color: '#f87171' },
  ],
  reasoning: [
    { label: 'Decisions/Min',  baseline: 48,  unit: '/m', color: '#a78bfa' },
    { label: 'Avg Confidence', baseline: 91,  unit: '%',  color: '#87986a' },
    { label: 'REA Active',     baseline: 7,   unit: '',   color: '#60a5fa' },
    { label: 'Model Calls',    baseline: 340, unit: '',   color: '#f59e0b' },
    { label: 'Bottlenecks',    baseline: 1,   unit: '',   color: '#f87171' },
  ],
  execution: [
    { label: 'Orders/Hr',    baseline: 24, unit: '/h', color: '#34d399' },
    { label: 'Payment Vol',  baseline: 42, unit: 'K',  color: '#87986a' },
    { label: 'EXE Active',   baseline: 8,  unit: '',   color: '#60a5fa' },
    { label: 'Success Rate', baseline: 98, unit: '%',  color: '#a78bfa' },
    { label: 'Queue Depth',  baseline: 14, unit: '',   color: '#f59e0b' },
  ],
  governance: [
    { label: 'Rules/Min',  baseline: 142, unit: '/m', color: '#f59e0b' },
    { label: 'Blocks',     baseline: 3,   unit: '',   color: '#f87171' },
    { label: 'GOV Active', baseline: 8,   unit: '',   color: '#87986a' },
    { label: 'Compliance', baseline: 97,  unit: '%',  color: '#34d399' },
    { label: 'Disputes',   baseline: 2,   unit: '',   color: '#a78bfa' },
  ],
  meta: [
    { label: 'Events/Sec', baseline: 1240, unit: '/s', color: '#ec4899' },
    { label: 'Memory Use', baseline: 68,   unit: '%',  color: '#f59e0b' },
    { label: 'MET Active', baseline: 7,    unit: '',   color: '#87986a' },
    { label: 'LLM Calls',  baseline: 340,  unit: '',   color: '#60a5fa' },
    { label: 'Self-Heals', baseline: 2,    unit: '',   color: '#34d399' },
  ],
};

const STAGE_THINKING: Record<number, string> = {
  1:  "SEN #001, #002, #003 active — ingesting 342 price, catalog, and POS signals per minute. Jakarta commodity feed nominal. Monitoring for exchange anomalies.",
  2:  "SEN #004 and REA #001 classifying 310 demand signals. F&B spike detected and routed to REA #003. Lamb rack inventory at 12% — escalated to EXE #006.",
  3:  "SEN #005 and #006 scanning 680+ supplier catalogs. 3 active shipments tracked. SE Asia typhoon alert ingested — 2 suppliers flagged for disruption risk.",
  4:  "REA #002 and #003 evaluating 24 active vendors. Indo Seafood dropped below 80% reliability threshold. REA #003 projecting 18% protein demand increase over 2 weeks.",
  5:  "BOTTLENECK — REA #004 processing 12 active price negotiations simultaneously. BeanHouse API averaging +340ms response latency. REA #005 competing for model bandwidth on 3 concurrent contract renewals.",
  6:  "GOV #001 enforcing 142 policy rules. GOV #003 cleared Vietnam compliance check. 6 POs queued, 0 blocked. New Vietnam VAT rule flagged for manual review.",
  7:  "EXE #001 assembling PO-4822 for AlphaFoods. EXE #002 dispatching RFQ to 6 protein suppliers. 4 POs queued for approval routing.",
  8:  "GOV #002 routing 3 POs through approval tiers. MET #001 managing orchestration queue. 2 items require human approval — both pending >4 hours.",
  9:  "EXE #003 processing payment to Pacific Supply — captured 2% early payment discount. EXE #004 coordinating 3 cold chain delivery schedules.",
  10: "SEN #005 tracking PO-2847 (arriving tomorrow, 09:00). EXE #005 matching 22 open invoices. 1 shipment shows 2-day delay risk — VN Supply carrier issue.",
  11: "EXE #005 reconciling INV-9920 against PO-4818. GOV #004 recording 28 decision entries. All settlements within SLA — 8 items in queue.",
  12: "MET #003 archived 2,400 memory entries to cold storage. MET #008 applied DAG optimization yielding +8% pipeline throughput. 4 models updated from recent outcomes.",
};

const STAGE_SIGNALS: Record<number, string[]> = {
  1:  ["Jakarta commodity prices", "Supplier catalog updates", "POS demand signals"],
  2:  ["F&B demand spike (↑18%)", "Lamb rack stock threshold", "Seasonal pattern match"],
  3:  ["SE Asia typhoon alert", "AlphaFoods catalog sync", "PO-2847 shipment tracking"],
  4:  ["Indo Seafood reliability (↓80%)", "Protein demand forecast +18%", "Vendor trust scores"],
  5:  ["BeanHouse quote (API +340ms)", "Coffee contract clause review", "Bulk olive oil optimization"],
  6:  ["Vietnam VAT update (new)", "Policy rule set v142", "Budget cap enforcement"],
  7:  ["AlphaFoods PO assembly", "Protein RFQ dispatch ×6", "Blanket PO queue ×4"],
  8:  ["Manager approval pending (4h)", "Budget guardian routing", "Compliance clearance"],
  9:  ["Pacific Supply payment", "Cold chain scheduling ×3", "2% discount captured"],
  10: ["PO-2847 GPS location", "VN Supply delay risk (2d)", "Invoice batch ×22"],
  11: ["INV-9920 reconciliation", "Decision audit trail ×28", "Settlement SLA check"],
  12: ["Memory archival ×2,400", "+8% DAG throughput gain", "Model outcome feedback"],
};

const INTERVENTION_MESSAGES: Record<string, string> = {
  force:   "Force Approval applied — Stage 5 queue cleared. 12 quotes pushed to Execution.",
  scale:   "Scaling workforce — 2 REA agents provisioned. ETA 45 seconds to restore throughput.",
  cooldown:"Stage 5 set to Suggest mode. Human review required for all price decisions.",
};

function SparklineCard({ label, baseline, unit, color, isDark }: { label: string; baseline: number; unit: string; color: string; isDark: boolean }) {
  const t = theme(isDark);
  const value = useSimulatedMetric(baseline);
  const history = transformationMetrics[0]?.history.slice(-10).map((_, i) => ({
    v: baseline + (Math.sin(i * 0.8) * baseline * 0.05),
  })) ?? [];

  const displayValue = baseline >= 1000
    ? `${(value / 1000).toFixed(1)}K`
    : unit === '%' ? `${value.toFixed(1)}%` : Math.round(value).toString();

  return (
    <div className={`${t.cardBorder} flex flex-col`}>
      <span className={`text-[10px] mb-1 ${t.textMuted}`}>{label}</span>
      <span className={`text-sm font-semibold tabular-nums ${t.textPrimary}`}>{displayValue}{unit && unit !== '%' && unit !== 'K' ? unit : ''}</span>
      <div className="h-8 mt-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={history}>
            <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function DagVisualization({ isDark, selectedClass, autonomyLevel, onAutonomyChange, systemStress, anomalyCount }: DagVisualizationProps) {
  const t = theme(isDark);
  const pulse = useHeartbeat(1200);
  const [selectedStage, setSelectedStage] = useState<DagStage | null>(null);
  const [coolDownAccepted, setCoolDownAccepted] = useState(false);
  const [softDismissed, setSoftDismissed] = useState(false);
  const [activeIntervention, setActiveIntervention] = useState<'force' | 'scale' | 'cooldown' | null>(null);

  // Two-tier banner thresholds
  const aboveStress   = systemStress > 85;
  const aboveAnomalies = anomalyCount > 300;
  const showUrgentBanner = aboveStress && aboveAnomalies && !coolDownAccepted;
  const showSoftBanner   = aboveStress && !aboveAnomalies && !coolDownAccepted && !softDismissed;

  // How many historical decisions are capped at the current global level
  const cappedCount = decisionRecords.filter(r => r.autonomyLevel > autonomyLevel).length;

  // Current metrics depend on class filter
  const currentMetrics = selectedClass ? CLASS_METRICS[selectedClass] : SPARKLINE_DEFS;

  // Reset intervention feedback when stage changes
  useEffect(() => { setActiveIntervention(null); }, [selectedStage?.id]);

  // Auto-clear intervention message after 5s
  useEffect(() => {
    if (!activeIntervention) return;
    const timer = setTimeout(() => setActiveIntervention(null), 5000);
    return () => clearTimeout(timer);
  }, [activeIntervention]);

  // Soft dismiss resets when stress drops back below threshold
  useEffect(() => {
    if (!aboveStress) setSoftDismissed(false);
  }, [aboveStress]);

  const handleCoolDown = () => {
    onAutonomyChange(2);
    setCoolDownAccepted(true);
  };

  // Whether a DAG stage involves agents of the selected class
  const stageHasSelectedClass = (stage: DagStage): boolean => {
    if (!selectedClass) return true;
    return agents.filter(a => stage.agents.includes(a.id)).some(a => a.class === selectedClass);
  };

  const stageStatusColor = (stage: DagStage) => {
    const s = stage.status;
    if (s === 'active')     return isDark ? 'border-green-500/60 bg-green-500/8'   : 'border-green-400 bg-green-50';
    if (s === 'bottleneck') return isDark ? 'border-red-500/70 bg-red-500/10'       : 'border-red-400 bg-red-50';
    return isDark ? 'border-gray-600/50 bg-gray-800/40' : 'border-gray-300 bg-gray-50';
  };

  const stageStatusDot = (status: string) => {
    if (status === 'active')     return 'bg-green-500';
    if (status === 'bottleneck') return 'bg-red-500';
    return 'bg-gray-500';
  };

  const row1 = dagStages.slice(0, 6);
  const row2 = dagStages.slice(6);

  const renderStageNode = (stage: DagStage) => {
    const stageAgents = agents.filter(a => stage.agents.includes(a.id));
    const activeCount = stageAgents.filter(a => a.status === 'active').length;
    const isSelected = selectedStage?.id === stage.id;
    const isRelevant = stageHasSelectedClass(stage);

    return (
      <button
        key={stage.id}
        onClick={() => setSelectedStage(isSelected ? null : stage)}
        className={`flex-1 min-w-0 p-2 rounded-lg border-2 text-left transition-all cursor-pointer hover:opacity-90 ${stageStatusColor(stage)} ${
          isSelected ? 'ring-2 ring-[#87986a] ring-offset-1 ' + (isDark ? 'ring-offset-[#111]' : 'ring-offset-white') : ''
        } ${stage.status === 'bottleneck' ? 'shadow-[0_0_8px_rgba(239,68,68,0.25)]' : ''} ${
          !isRelevant ? 'opacity-25 grayscale' : ''
        }`}
      >
        <div className="flex items-center gap-1 mb-0.5">
          <div className="relative shrink-0">
            <div className={`w-2 h-2 rounded-full ${stageStatusDot(stage.status)}`} />
            {stage.status === 'active' && pulse && (
              <div className={`absolute inset-0 w-2 h-2 rounded-full ${stageStatusDot(stage.status)} opacity-40 animate-ping`} />
            )}
            {stage.status === 'bottleneck' && (
              <div className="absolute inset-0 w-2 h-2 rounded-full bg-red-500 opacity-60 animate-pulse" />
            )}
          </div>
          <span className={`text-[10px] font-mono ${t.textMuted}`}>S{stage.id}</span>
        </div>
        <div className={`text-[10px] font-medium mb-1 truncate ${t.textPrimary}`}>{stage.name}</div>
        <div className="flex items-center justify-between">
          <span className={`text-[9px] ${t.textMuted}`}>{activeCount}/{stageAgents.length}</span>
          <span className={`text-[9px] tabular-nums ${t.textMuted}`}>{stage.throughput}</span>
        </div>
      </button>
    );
  };

  // Neural connection arrow — base arrow + sage glow pulse overlay
  const renderNeuralArrow = () => (
    <div className="relative shrink-0 w-4 h-2.5 flex items-center">
      <svg width="16" height="10" viewBox="0 0 16 10" className="absolute inset-0">
        <line x1="0" y1="5" x2="10" y2="5" stroke={isDark ? '#3a3a3a' : '#d1d5db'} strokeWidth="1.5" />
        <polygon points="10,2 16,5 10,8" fill={isDark ? '#3a3a3a' : '#d1d5db'} />
      </svg>
      <svg width="16" height="10" viewBox="0 0 16 10" className="absolute inset-0 animate-pulse">
        <line x1="0" y1="5" x2="10" y2="5" stroke="#87986a" strokeWidth="1.5" strokeOpacity="0.5" />
      </svg>
    </div>
  );

  return (
    <div className="p-6 space-y-5">

      {/* Soft banner — stress only (pre-emptive) */}
      {showSoftBanner && (
        <div className={`flex items-start gap-3 p-3 rounded-xl border ${isDark ? 'bg-amber-500/6 border-amber-500/20' : 'bg-amber-50/80 border-amber-200'}`}>
          <Thermometer className={`h-4 w-4 mt-0.5 shrink-0 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />
          <div className="flex-1 min-w-0">
            <p className={`text-xs font-semibold mb-0.5 ${isDark ? 'text-amber-300' : 'text-amber-800'}`}>
              System Stress Elevated — Cool Down Available
            </p>
            <p className={`text-xs ${isDark ? 'text-amber-400/80' : 'text-amber-700'}`}>
              Stress at {systemStress}%. Pipeline is working hard but stable. No anomaly spike yet. Pre-emptive Cool Down available if you expect continued pressure.
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={handleCoolDown}
              className={`text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors ${isDark ? 'bg-amber-500/15 border-amber-500/20 text-amber-400 hover:bg-amber-500/25' : 'bg-amber-100 border-amber-200 text-amber-700 hover:bg-amber-200'}`}
            >
              Cool Down
            </button>
            <button
              onClick={() => setSoftDismissed(true)}
              className={`p-1 rounded transition-colors ${isDark ? 'text-amber-500/50 hover:text-amber-400 hover:bg-amber-500/10' : 'text-amber-400 hover:bg-amber-100'}`}
              title="Dismiss"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}

      {/* Urgent banner — both thresholds exceeded */}
      {showUrgentBanner && (
        <div className={`flex items-start gap-3 p-3 rounded-xl border ${isDark ? 'bg-red-500/8 border-red-500/30' : 'bg-red-50 border-red-200'}`}>
          <AlertTriangle className={`h-4 w-4 mt-0.5 shrink-0 animate-pulse ${isDark ? 'text-red-400' : 'text-red-600'}`} />
          <div className="flex-1 min-w-0">
            <p className={`text-xs font-semibold mb-0.5 ${isDark ? 'text-red-300' : 'text-red-800'}`}>
              Atlas: Urgent — Both Thresholds Exceeded
            </p>
            <p className={`text-xs ${isDark ? 'text-red-400/80' : 'text-red-700'}`}>
              Stress {systemStress}% · Anomalies {anomalyCount}. Expect delays in new order creation. Downshift to L2 recommended immediately.
            </p>
          </div>
          <button
            onClick={handleCoolDown}
            className={`shrink-0 text-xs font-semibold px-3 py-1 rounded-lg border transition-colors ${isDark ? 'bg-red-500/20 border-red-500/25 text-red-300 hover:bg-red-500/30' : 'bg-red-100 border-red-200 text-red-700 hover:bg-red-200'}`}
          >
            Accept
          </button>
        </div>
      )}

      {/* Section: DAG Kernel */}
      <div id="nc-dag-kernel">
        <div className="flex items-center justify-between mb-0.5">
          <h2 className={`text-sm font-semibold flex items-center gap-1.5 ${t.textPrimary}`}>
            12-Stage Logic DAG — Decision Kernel
            <InfoTooltip
              text="The complete step-by-step path every purchase takes, from detecting a need to settling the invoice. Green = healthy, red = backlog forming. Click any step to inspect and intervene."
              isDark={isDark}
              side="bottom"
            />
          </h2>
          <span className={`text-[10px] ${t.textMuted}`}>Click a stage to inspect</span>
        </div>
        <p className={`text-xs mb-3 ${t.textMuted}`}>
          {selectedClass
            ? `Highlighting ${selectedClass} class stages — ops/min`
            : 'Neural decision pipeline — real-time ops/min'}
        </p>

        {/* DAG flow — 2 rows of 6 with neural arrows */}
        <div className="space-y-1.5">
          {[row1, row2].map((row, ri) => (
            <div key={ri} className="flex items-center gap-1">
              {row.map((stage, i) => (
                <div key={stage.id} className="flex items-center gap-1 flex-1 min-w-0">
                  {renderStageNode(stage)}
                  {i < row.length - 1 && renderNeuralArrow()}
                </div>
              ))}
            </div>
          ))}
          {/* Row connector with neural pulse */}
          <div className="flex justify-center -my-0.5">
            <div className="relative w-3 h-4">
              <svg width="12" height="16" viewBox="0 0 12 16" className="absolute inset-0">
                <line x1="6" y1="0" x2="6" y2="10" stroke={isDark ? '#3a3a3a' : '#d1d5db'} strokeWidth="1.5" />
                <polygon points="2,10 6,16 10,10" fill={isDark ? '#3a3a3a' : '#d1d5db'} />
              </svg>
              <svg width="12" height="16" viewBox="0 0 12 16" className="absolute inset-0 animate-pulse">
                <line x1="6" y1="0" x2="6" y2="10" stroke="#87986a" strokeWidth="1.5" strokeOpacity="0.5" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Active Thinking Panel */}
      {selectedStage && (
        <div className={`rounded-xl border p-4 ${isDark ? 'bg-[#1e1e1e] border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Brain className={`h-4 w-4 ${isDark ? 'text-[#a3b085]' : 'text-[#87986a]'}`} />
              <span className={`text-xs font-semibold ${t.textPrimary}`}>Stage {selectedStage.id}: {selectedStage.name}</span>
              {selectedStage.status === 'bottleneck' && (
                <span className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border ${isDark ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-red-50 text-red-600 border-red-200'}`}>
                  <AlertTriangle className="h-2.5 w-2.5" /> Bottleneck
                </span>
              )}
              <span className={`text-[10px] tabular-nums ${t.textMuted}`}>{selectedStage.throughput} ops/min</span>
            </div>
            <button onClick={() => setSelectedStage(null)} className={`p-0.5 rounded ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-200'}`}>
              <X className={`h-3.5 w-3.5 ${t.textMuted}`} />
            </button>
          </div>

          <p className={`text-xs leading-relaxed mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            {STAGE_THINKING[selectedStage.id]}
          </p>

          <div className="mb-3">
            <p className={`text-[10px] font-semibold tracking-wider mb-1.5 ${t.textMuted}`}>SIGNALS PROCESSING</p>
            <div className="flex flex-wrap gap-1.5">
              {STAGE_SIGNALS[selectedStage.id].map(sig => (
                <span key={sig} className={`text-[10px] px-2 py-0.5 rounded-full border ${isDark ? 'bg-[#2a2a2a] border-gray-700 text-gray-300' : 'bg-white border-gray-200 text-gray-700'}`}>
                  {sig}
                </span>
              ))}
            </div>
          </div>

          {/* Bottleneck intervention buttons */}
          {selectedStage.status === 'bottleneck' && (
            <div className={`pt-3 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
              <p className={`text-[10px] font-semibold tracking-wider mb-2 ${isDark ? 'text-red-400/80' : 'text-red-500'}`}>INTERVENTIONS</p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setActiveIntervention('force')}
                  className={`text-[10px] px-2.5 py-1.5 rounded-lg border font-medium transition-colors ${isDark ? 'bg-amber-500/10 border-amber-500/25 text-amber-400 hover:bg-amber-500/20' : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'}`}
                >
                  ⚖️ Force Approval
                </button>
                <button
                  onClick={() => setActiveIntervention('scale')}
                  className={`text-[10px] px-2.5 py-1.5 rounded-lg border font-medium transition-colors ${isDark ? 'bg-blue-500/10 border-blue-500/25 text-blue-400 hover:bg-blue-500/20' : 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'}`}
                >
                  🚀 Scale Workforce
                </button>
                <button
                  onClick={() => setActiveIntervention('cooldown')}
                  className={`text-[10px] px-2.5 py-1.5 rounded-lg border font-medium transition-colors ${isDark ? 'bg-gray-700/40 border-gray-600/50 text-gray-400 hover:bg-gray-700/60' : 'bg-gray-100 border-gray-300 text-gray-600 hover:bg-gray-200'}`}
                >
                  ⏸️ Cool Down Stage
                </button>
              </div>
              {activeIntervention && (
                <p className={`text-xs mt-2 ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                  ✓ {INTERVENTION_MESSAGES[activeIntervention]}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Section: Live Metrics (class-aware) */}
      <div id="nc-live-metrics">
        <div className="flex items-center gap-2 mb-3">
          <h3 className={`text-xs font-semibold tracking-wider flex items-center gap-1.5 ${t.textMuted}`}>
            {selectedClass ? `${selectedClass.toUpperCase()} CLASS METRICS` : 'LIVE METRICS'}
            <InfoTooltip
              text="Real-time counters for the whole system — or just the selected team when you click a group on the left."
              isDark={isDark}
              side="top"
            />
          </h3>
          {selectedClass && (
            <span className={`text-[10px] ${isDark ? 'text-[#a3b085]/70' : 'text-[#87986a]/80'}`}>
              — filtered view
            </span>
          )}
        </div>
        <div className="grid grid-cols-3 lg:grid-cols-5 gap-2">
          {currentMetrics.map(s => (
            <SparklineCard key={s.label} {...s} isDark={isDark} />
          ))}
        </div>
      </div>

      {/* Section: Global Autonomy Cap */}
      <div id="nc-autonomy-cap">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h3 className={`text-xs font-semibold tracking-wider flex items-center gap-1.5 ${t.textMuted}`}>
              GLOBAL AUTONOMY CAP
              <InfoTooltip
                text="Your master override for the entire system. Slide left to require more human approval on every action. Slide right to let the AI run more independently."
                isDark={isDark}
                side="top"
              />
            </h3>
            <p className={`text-[10px] mt-0.5 ${t.textMuted}`}>All agents & transactions capped at this level</p>
          </div>
          <div className="text-right shrink-0">
            <div className={`text-xs font-semibold ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}>
              L{autonomyLevel} — {AUTONOMY_LABELS[autonomyLevel]}
            </div>
            {cappedCount > 0 && (
              <div className={`text-[10px] mt-0.5 ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
                ⚠️ {cappedCount} decisions capped
              </div>
            )}
          </div>
        </div>
        <div className={`${t.cardPanel} p-3`}>
          <div className="flex items-center gap-1">
            {([0, 1, 2, 3, 4, 5] as AutonomyLevel[]).map(level => {
              const isActive  = level <= autonomyLevel;
              const isCurrent = level === autonomyLevel;
              return (
                <button
                  key={level}
                  onClick={() => onAutonomyChange(level)}
                  className="flex-1 flex flex-col items-center gap-1.5 group"
                  title={`Set global cap to L${level}: ${AUTONOMY_LABELS[level]}`}
                >
                  <div className={`w-full h-2.5 rounded-full transition-all duration-300 ${
                    isCurrent
                      ? 'bg-[#87986a] shadow-[0_0_6px_rgba(135,152,106,0.5)]'
                      : isActive
                        ? 'bg-[#87986a]/55'
                        : isDark ? 'bg-gray-700 group-hover:bg-gray-600' : 'bg-gray-200 group-hover:bg-gray-300'
                  }`} />
                  <span className={`text-[9px] text-center leading-tight transition-colors ${
                    isCurrent ? isDark ? 'text-[#a3b085] font-semibold' : 'text-[#6b7a54] font-semibold' : t.textMuted
                  }`}>
                    L{level}
                  </span>
                </button>
              );
            })}
          </div>
          <p className={`text-[10px] mt-2 text-center ${t.textMuted}`}>
            Click to raise or lower the system-wide autonomy ceiling
          </p>
        </div>
      </div>
    </div>
  );
}
