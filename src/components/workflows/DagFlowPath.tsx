import { useState, useEffect } from 'react';
import { CheckCircle, Clock, AlertTriangle, Play, Copy, CalendarClock, Settings, FlaskConical, X, FileText, Zap, ScrollText, Users, AlertCircle, Factory, Wrench, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { InfoTooltip } from '../ui/InfoTooltip';
import { Button } from '../ui/button';
import { dagStages, agents, workflowTemplates, demandSignals } from '../../lib/mockData';
import { useHeartbeat } from '../../hooks/useHeartbeat';
import { useConstraints } from '../../hooks/useConstraints';
import { constraintStore } from '../../lib/constraintStore';
import { theme } from '../../lib/theme';
import { AutonomyLadder } from './AutonomyLadder';
import type { AutonomyLevel } from '../../lib/types';

interface DagFlowPathProps {
  isDark: boolean;
  selectedWorkflowId: string | null;
  selectedSignalId: string | null;
}

interface TuneConfig {
  label: string;
  description: string;
  min: number;
  max: number;
  defaultValue: number;
  unit: string;
}

const STAGE_TUNE_CONFIG: Record<number, TuneConfig> = {
  1:  { label: 'Signal Sensitivity',     description: 'Minimum signal strength to trigger intake. ≥90% activates a system hard-lock.',  min: 10, max: 90, defaultValue: 60, unit: '%'     },
  2:  { label: 'Demand Confidence',       description: 'Threshold to classify a demand as confirmed',                                    min: 50, max: 95, defaultValue: 75, unit: '%'     },
  3:  { label: 'Supplier Scan Depth',     description: 'Number of supplier tiers to search',                                            min: 1,  max: 5,  defaultValue: 3,  unit: 'tiers'  },
  4:  { label: 'Evaluation Strictness',   description: 'Minimum vendor score to advance',                                               min: 40, max: 90, defaultValue: 65, unit: 'pts'   },
  5:  { label: 'Price Tolerance',         description: 'Max acceptable price variance vs. benchmark',                                   min: 0,  max: 20, defaultValue: 8,  unit: '%'     },
  6:  { label: 'Compliance Scope',        description: 'Rule categories checked before passing',                                        min: 1,  max: 6,  defaultValue: 4,  unit: 'rules'  },
  7:  { label: 'Bundle Threshold',        description: 'Min order count before bundling into single PO',                                min: 1,  max: 10, defaultValue: 3,  unit: 'orders' },
  8:  { label: 'Approval Timeout',        description: 'Hours before auto-escalation triggers',                                        min: 1,  max: 48, defaultValue: 8,  unit: 'hrs'   },
  9:  { label: 'Execution Concurrency',   description: 'Max simultaneous PO submissions',                                              min: 1,  max: 20, defaultValue: 5,  unit: 'POs'   },
  10: { label: 'Tracking Interval',       description: 'Minutes between delivery status refreshes',                                    min: 5,  max: 60, defaultValue: 15, unit: 'min'   },
  11: { label: 'Settlement Window',       description: 'Days after delivery to auto-close invoice',                                    min: 1,  max: 30, defaultValue: 7,  unit: 'days'  },
  12: { label: 'Feedback Depth',          description: 'Number of past cycles included in learning pass',                              min: 5,  max: 50, defaultValue: 20, unit: 'cycles' },
};


function agentNumber(id: string): number {
  return agents.findIndex(a => a.id === id) + 1;
}

const WORKFLOW_HERO_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  FileText, Zap, ScrollText, Users, AlertCircle, Factory, Wrench, Building2,
};

const WORKFLOW_PERF_DATA: Record<string, { active: number; avgTime: string; savings: string }> = {
  'WF-STD': { active: 124, avgTime: '5.8d',  savings: '$18.4K' },
  'WF-RSH': { active: 31,  avgTime: '38h',   savings: '$3.2K'  },
  'WF-BPO': { active: 8,   avgTime: '18d',   savings: '$42.1K' },
  'WF-GRP': { active: 12,  avgTime: '9d',    savings: '$11.8K' },
  'WF-EMR': { active: 7,   avgTime: '3.5h',  savings: '$1.4K'  },
  'WF-PRD': { active: 22,  avgTime: '4.2d',  savings: '$28.9K' },
  'WF-MNT': { active: 14,  avgTime: '4.1d',  savings: '$5.3K'  },
  'WF-CPX': { active: 4,   avgTime: '28d',   savings: '$63.7K' },
};

function getComplexityStyle(complexity: string, isDark: boolean) {
  if (complexity === 'simple') return isDark
    ? { bg: 'bg-green-500/10', border: 'border-green-500/25', iconBg: 'bg-green-500/15', iconColor: 'text-green-400', badge: 'bg-green-500/15 text-green-400 border-green-500/20', accentHex: '#22c55e' }
    : { bg: 'bg-green-50',     border: 'border-green-200',    iconBg: 'bg-green-100',    iconColor: 'text-green-600', badge: 'bg-green-50 text-green-700 border-green-200',        accentHex: '#16a34a' };
  if (complexity === 'medium') return isDark
    ? { bg: 'bg-amber-500/10', border: 'border-amber-500/25', iconBg: 'bg-amber-500/15', iconColor: 'text-amber-400', badge: 'bg-amber-500/15 text-amber-400 border-amber-500/20', accentHex: '#f59e0b' }
    : { bg: 'bg-amber-50',     border: 'border-amber-200',    iconBg: 'bg-amber-100',    iconColor: 'text-amber-600', badge: 'bg-amber-50 text-amber-700 border-amber-200',        accentHex: '#d97706' };
  return isDark
    ? { bg: 'bg-purple-500/10', border: 'border-purple-500/25', iconBg: 'bg-purple-500/15', iconColor: 'text-purple-400', badge: 'bg-purple-500/15 text-purple-400 border-purple-500/20', accentHex: '#a855f7' }
    : { bg: 'bg-purple-50',     border: 'border-purple-200',    iconBg: 'bg-purple-100',    iconColor: 'text-purple-600', badge: 'bg-purple-50 text-purple-700 border-purple-200',        accentHex: '#9333ea' };
}

export function DagFlowPath({ isDark, selectedWorkflowId, selectedSignalId }: DagFlowPathProps) {
  const t = theme(isDark);
  const pulse = useHeartbeat(1200);
  const constraints = useConstraints();
  const signalSensitivityLocked = (constraints.get('signal-sensitivity') ?? 0) >= 90;

  const [tuningStageId, setTuningStageId] = useState<number | null>(null);
  const [tuneValues, setTuneValues] = useState<Record<number, number>>({});
  const [appliedStages, setAppliedStages] = useState<Set<number>>(new Set());

  // Simulation state — driven by IntelligencePanel
  const [simActive, setSimActive] = useState(false);
  const [simBottleneckStageIds, setSimBottleneckStageIds] = useState<Set<number>>(new Set());
  const [simOverstressedAgentIds, setSimOverstressedAgentIds] = useState<Set<string>>(new Set());

  // Highlight stage from IntelligencePanel exceptions
  const [highlightedStageId, setHighlightedStageId] = useState<number | null>(null);

  useEffect(() => {
    const clearSim = () => { setSimActive(false); setSimBottleneckStageIds(new Set()); setSimOverstressedAgentIds(new Set()); };
    const onOpen = () => setSimActive(true);
    const onScenario = (e: Event) => {
      const d = (e as CustomEvent<{ bottleneckStages: number[]; overstressedAgents: string[] } | null>).detail;
      if (d) { setSimBottleneckStageIds(new Set(d.bottleneckStages)); setSimOverstressedAgentIds(new Set(d.overstressedAgents)); }
      else    { setSimBottleneckStageIds(new Set()); setSimOverstressedAgentIds(new Set()); }
    };
    const onHighlight = (e: Event) => {
      const stageId = (e as CustomEvent<number>).detail;
      setHighlightedStageId(stageId);
      setTimeout(() => setHighlightedStageId(null), 3000);
    };
    window.addEventListener('buyamia-workflow-simulate',     onOpen);
    window.addEventListener('buyamia-workflow-sim-exit',     clearSim);
    window.addEventListener('buyamia-workflow-apply-fix',    clearSim);
    window.addEventListener('buyamia-workflow-sim-scenario', onScenario);
    window.addEventListener('buyamia-workflow-highlight-stage', onHighlight);
    return () => {
      window.removeEventListener('buyamia-workflow-simulate',     onOpen);
      window.removeEventListener('buyamia-workflow-sim-exit',     clearSim);
      window.removeEventListener('buyamia-workflow-apply-fix',    clearSim);
      window.removeEventListener('buyamia-workflow-sim-scenario', onScenario);
      window.removeEventListener('buyamia-workflow-highlight-stage', onHighlight);
    };
  }, []);

  const workflow = workflowTemplates.find(w => w.id === selectedWorkflowId);
  const selectedSignal = selectedSignalId ? demandSignals.find(s => s.id === selectedSignalId) : null;

  const signalStageIds = new Set<number>();
  if (selectedSignal) {
    selectedSignal.relatedWorkflows.forEach(wfId => {
      const wf = workflowTemplates.find(w => w.id === wfId);
      if (wf) wf.stages.forEach(s => signalStageIds.add(s));
    });
  }

  if (!workflow) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center">
          <div className={`text-sm ${t.textMuted}`}>Select a workflow template</div>
          <p className={`text-xs mt-1 ${t.textMuted}`}>to view its DAG flow path and assigned agents</p>
        </div>
      </div>
    );
  }

  const WorkflowIcon = WORKFLOW_HERO_ICONS[workflow.icon] || FileText;
  const cc = getComplexityStyle(workflow.complexity, isDark);
  const perfHero = WORKFLOW_PERF_DATA[workflow.id];

  const workflowStages = dagStages.filter(s => workflow.stages.includes(s.id));
  const workflowAutonomy: AutonomyLevel = workflow.complexity === 'simple' ? 4 : workflow.complexity === 'medium' ? 3 : 2;

  const handleTuneToggle = (stageId: number) => {
    const opening = tuningStageId !== stageId;
    setTuningStageId(opening ? stageId : null);
    window.dispatchEvent(new CustomEvent('buyamia-workflow-tune-stage', { detail: opening ? stageId : null }));
    if (opening && !(stageId in tuneValues)) {
      setTuneValues(prev => ({ ...prev, [stageId]: STAGE_TUNE_CONFIG[stageId]?.defaultValue ?? 50 }));
    }
  };

  const handleApply = (stageId: number) => {
    setAppliedStages(prev => new Set(prev).add(stageId));
    setTuningStageId(null);
    // Hard-lock: Stage 1 Signal Sensitivity ≥ 90% becomes a system constraint
    if (stageId === 1) {
      const val = tuneValues[stageId] ?? STAGE_TUNE_CONFIG[1].defaultValue;
      if (val >= 90) {
        constraintStore.set('signal-sensitivity', val);
      } else {
        constraintStore.delete('signal-sensitivity');
      }
    }
  };

  const handleCancel = (stageId: number) => {
    setTuneValues(prev => { const next = { ...prev }; delete next[stageId]; return next; });
    setTuningStageId(null);
  };

  return (
    <div className="p-6 space-y-4 overflow-auto min-h-0 h-full">

      {/* Hard-lock notice */}
      {signalSensitivityLocked && (
        <div className={`rounded-lg border px-3 py-2 flex items-center gap-2 text-[10px] ${
          isDark ? 'bg-amber-500/10 border-amber-500/30 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-800'
        }`}>
          <span className="font-bold">👤 User Hard-Lock active</span>
          <span className="opacity-80">Signal Sensitivity set to {constraints.get('signal-sensitivity')}% — agents in Stage 1 are operating under your explicit constraint.</span>
          <button
            onClick={() => constraintStore.delete('signal-sensitivity')}
            className="ml-auto underline opacity-70 hover:opacity-100"
          >Release</button>
        </div>
      )}

      {/* Workflow Hero */}
      <div id="wf-workflow-hero" className={`rounded-xl border p-4 ${cc.bg} ${cc.border}`}>
        <div className="flex items-start gap-4">
          {/* Icon identity */}
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${cc.iconBg}`}>
            <WorkflowIcon className={`w-6 h-6 ${cc.iconColor}`} />
          </div>

          {/* Name + meta */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h2 className={`text-base font-bold ${t.textPrimary}`}>{workflow.name}</h2>
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border capitalize ${cc.badge}`}>
                {workflow.complexity}
              </span>
              {simActive ? (
                <span className={`ml-auto flex items-center gap-1 text-[10px] px-2 py-1 rounded border ${
                  isDark ? 'border-[#87986a]/40 bg-[#87986a]/10 text-[#a3b085]' : 'border-[#dbe3ce] bg-[#f4f6f0] text-[#6b7a54]'
                }`}>
                  <FlaskConical className={`h-3 w-3 ${simBottleneckStageIds.size > 0 ? 'animate-pulse' : ''}`} />
                  {simBottleneckStageIds.size > 0 ? 'Simulating' : 'Sim Ready'}
                </span>
              ) : (
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent('buyamia-workflow-simulate'))}
                  className={`ml-auto flex items-center gap-1 text-[10px] px-2 py-1 rounded border transition-colors ${
                    isDark ? 'border-[#87986a]/30 text-[#a3b085] hover:bg-[#87986a]/10' : 'border-[#dbe3ce] text-[#6b7a54] hover:bg-[#f4f6f0]'
                  }`}
                >
                  <FlaskConical className="h-3 w-3" />
                  Simulate
                </button>
              )}
            </div>
            <p className={`text-xs mb-3 ${t.textMuted}`}>{workflow.description}</p>

            {/* Stats strip */}
            {perfHero && (
              <div className={`flex rounded-lg overflow-hidden border ${isDark ? 'border-gray-700/50' : 'border-gray-200'}`}>
                <div className={`flex-1 px-3 py-2 text-center border-r ${isDark ? 'border-gray-700/50 bg-black/20' : 'border-gray-200 bg-white/70'}`}>
                  <div className="text-sm font-bold tabular-nums" style={{ color: cc.accentHex }}>{perfHero.active}</div>
                  <div className={`text-[10px] ${t.textMuted}`}>active</div>
                </div>
                <div className={`flex-1 px-3 py-2 text-center border-r ${isDark ? 'border-gray-700/50 bg-black/20' : 'border-gray-200 bg-white/70'}`}>
                  <div className={`text-sm font-bold tabular-nums ${t.textPrimary}`}>{workflow.stages.length}</div>
                  <div className={`text-[10px] ${t.textMuted}`}>stages</div>
                </div>
                <div className={`flex-1 px-3 py-2 text-center border-r ${isDark ? 'border-gray-700/50 bg-black/20' : 'border-gray-200 bg-white/70'}`}>
                  <div className={`text-sm font-bold tabular-nums ${t.textPrimary}`}>{workflow.avgDuration}</div>
                  <div className={`text-[10px] ${t.textMuted}`}>avg duration</div>
                </div>
                <div className={`flex-1 px-3 py-2 text-center ${isDark ? 'bg-black/20' : 'bg-white/70'}`}>
                  <div className={`text-sm font-bold tabular-nums ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{perfHero.savings}</div>
                  <div className={`text-[10px] ${t.textMuted}`}>saved</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Signal banner */}
        {selectedSignal && (
          <div className={`mt-3 flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-[10px] ${
            isDark ? 'bg-[#87986a]/10 border-[#87986a]/30 text-[#a3b085]' : 'bg-[#f4f6f0] border-[#dbe3ce] text-[#6b7a54]'
          }`}>
            <span className="font-bold">⚡ {selectedSignal.name}</span>
            <span className="opacity-70">— lit stages highlighted below</span>
          </div>
        )}
      </div>

      {/* DAG Flow Path */}
      <div id="wf-flow-path">
        <h3 className={`text-xs font-semibold mb-3 flex items-center gap-1.5 ${t.textSecondary}`}>
          FLOW PATH
          <InfoTooltip
            text="Every step your AI takes from detecting a need to closing the invoice. Each row shows the step name, the AI agents working on it, and a 'Tune Logic' button to adjust how that step behaves."
            isDark={isDark}
            side="top"
          />
        </h3>
        <div className="space-y-0">
          {workflowStages.map((stage, i) => {
            const stageAgents = agents.filter(a => stage.agents.includes(a.id));
            const isSignalLit = signalStageIds.has(stage.id);
            const isTuning = tuningStageId === stage.id;
            const isApplied = appliedStages.has(stage.id);
            const tuneConfig = STAGE_TUNE_CONFIG[stage.id];
            const currentTuneVal = tuneValues[stage.id] ?? tuneConfig?.defaultValue ?? 50;

            // Simulation state for this stage
            const isSimBottleneck = simBottleneckStageIds.has(stage.id);
            const isHighlighted = highlightedStageId === stage.id;
            const isGhosted = simActive && !isSimBottleneck && simBottleneckStageIds.size > 0;

            const statusIcon =
              isSimBottleneck
                ? <AlertTriangle className={`h-4 w-4 ${isDark ? 'text-[#a3b085]' : 'text-[#87986a]'}`} />
                : stage.status === 'active'
                  ? <CheckCircle className="h-4 w-4 text-green-500" />
                  : stage.status === 'bottleneck'
                    ? <AlertTriangle className="h-4 w-4 text-red-500" />
                    : <Clock className="h-4 w-4 text-gray-500" />;

            return (
              <div key={stage.id} className={`transition-opacity duration-300 ${isGhosted ? 'opacity-35' : 'opacity-100'}`}>
                <div className={`p-3 rounded-lg border transition-all ${
                  isHighlighted
                    ? isDark
                      ? 'border-amber-400/60 bg-amber-500/8 ring-1 ring-amber-400/30'
                      : 'border-amber-400 bg-amber-50 ring-1 ring-amber-300/50'
                    : isSimBottleneck
                      ? isDark
                        ? 'border-[#87986a]/60 bg-[#87986a]/8 ring-1 ring-[#87986a]/30 animate-pulse'
                        : 'border-[#87986a]/60 bg-[#f4f6f0] ring-1 ring-[#87986a]/30 animate-pulse'
                      : isSignalLit
                        ? isDark
                          ? 'border-[#87986a]/50 bg-[#87986a]/8'
                          : 'border-[#87986a]/40 bg-[#f4f6f0]'
                        : isDark
                          ? 'border-gray-800 bg-[#1e1e1e]'
                          : 'border-gray-200 bg-white'
                }`}>
                  <div className="flex items-start gap-3">
                    <div className="relative shrink-0 mt-0.5">
                      {statusIcon}
                      {stage.status === 'active' && !isSimBottleneck && pulse && (
                        <div className="absolute inset-0 rounded-full bg-green-500/20 animate-ping" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`text-xs font-medium ${t.textPrimary}`}>S{stage.id}: {stage.name}</span>
                        {isSimBottleneck && (
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                            isDark ? 'bg-[#87986a]/15 text-[#a3b085] border-[#87986a]/30' : 'bg-[#f4f6f0] text-[#6b7a54] border-[#dbe3ce]'
                          }`}>⚠ Predicted Bottleneck</span>
                        )}
                        {isSignalLit && selectedSignal && !isSimBottleneck && (
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                            isDark ? 'bg-[#87986a]/15 text-[#a3b085] border-[#87986a]/30' : 'bg-[#f4f6f0] text-[#6b7a54] border-[#dbe3ce]'
                          }`}>⚡ {selectedSignal.name}</span>
                        )}
                        {isApplied && (
                          <span className={`flex items-center gap-1 text-[10px] font-medium ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}>
                            <Settings className="h-3 w-3" /> Tuned
                          </span>
                        )}
                        <span className={`ml-auto text-[10px] ${t.textMuted}`}>{stage.throughput} ops/m</span>
                      </div>

                      {/* Agent identity bridge */}
                      <div className="flex flex-wrap gap-1 mb-2">
                        {stageAgents.map(a => {
                          const isOverstressed = simOverstressedAgentIds.has(a.id);
                          const isConstrained = signalSensitivityLocked && stage.id === 1;
                          return (
                            <span
                              key={a.id}
                              className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] ${
                                isOverstressed
                                  ? isDark ? 'bg-[#87986a]/15 text-[#a3b085]' : 'bg-[#f4f6f0] text-[#6b7a54]'
                                  : isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              🤖 Agent #{agentNumber(a.id)} ({a.id}) · {a.description}
                              {isOverstressed && <span className="ml-0.5 text-[9px] font-bold">⚠ Overstressed</span>}
                              {isConstrained && <span className="ml-0.5 text-[9px] font-bold">👤 User Constrained</span>}
                            </span>
                          );
                        })}
                      </div>

                      {/* Tune Logic button */}
                      {tuneConfig && (
                        <button
                          onClick={() => handleTuneToggle(stage.id)}
                          className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border transition-colors ${
                            isTuning
                              ? isDark
                                ? 'bg-[#87986a]/20 border-[#87986a]/40 text-[#a3b085]'
                                : 'bg-[#f4f6f0] border-[#87986a]/40 text-[#6b7a54]'
                              : isDark
                                ? 'border-gray-700 text-gray-500 hover:border-gray-500 hover:text-gray-300'
                                : 'border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-700'
                          }`}
                        >
                          <Settings className="h-2.5 w-2.5" />
                          {isTuning ? 'Close' : 'Tune Logic'}
                          {stage.id === 1 && <span className="ml-1 text-[9px] opacity-60">↑90% = hard-lock</span>}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Inline Tune Logic panel */}
                  {isTuning && tuneConfig && (
                    <div className={`mt-3 pt-3 border-t ${isDark ? 'border-gray-700/60' : 'border-gray-200'}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-[10px] font-semibold ${t.textPrimary}`}>{tuneConfig.label}</span>
                        <span className={`text-[10px] font-bold tabular-nums ${
                          stage.id === 1 && currentTuneVal >= 90
                            ? isDark ? 'text-amber-400' : 'text-amber-600'
                            : isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'
                        }`}>
                          {currentTuneVal} {tuneConfig.unit}
                          {stage.id === 1 && currentTuneVal >= 90 && ' 🔒'}
                        </span>
                      </div>
                      <p className={`text-[10px] mb-2 ${t.textMuted}`}>{tuneConfig.description}</p>
                      <input
                        type="range"
                        min={tuneConfig.min}
                        max={tuneConfig.max}
                        value={currentTuneVal}
                        onChange={e => setTuneValues(prev => ({ ...prev, [stage.id]: +e.target.value }))}
                        className="w-full h-1 rounded-full appearance-none cursor-pointer mb-3"
                        style={{ accentColor: stage.id === 1 && currentTuneVal >= 90 ? '#f59e0b' : '#87986a' }}
                      />
                      {stage.id === 1 && currentTuneVal >= 90 && (
                        <p className={`text-[9px] mb-2 font-medium ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
                          👤 Hard-lock threshold reached — agents SEN-001, SEN-002, SEN-003 will show "User Constrained" in Nerve Center.
                        </p>
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApply(stage.id)}
                          className="flex-1 py-1 rounded text-[10px] font-semibold bg-[#87986a] hover:bg-[#6b7a54] text-white transition-colors"
                        >
                          Apply{stage.id === 1 && currentTuneVal >= 90 ? ' & Lock' : ''}
                        </button>
                        <button
                          onClick={() => handleCancel(stage.id)}
                          className={`flex-1 py-1 rounded text-[10px] font-semibold border transition-colors ${
                            isDark ? 'border-gray-700 text-gray-400 hover:bg-gray-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {i < workflowStages.length - 1 && (
                  <div className="flex justify-center py-1">
                    <div className={`w-px h-4 ${isDark ? 'bg-gray-700' : 'bg-gray-300'}`} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Autonomy Ladder */}
      <div id="wf-autonomy">
        <h3 className={`text-xs font-semibold mb-3 flex items-center gap-1.5 ${t.textSecondary}`}>
          WORKFLOW AUTONOMY
          <InfoTooltip
            text="How much the AI is trusted to act on its own for this type of purchase. Higher autonomy = fewer interruptions. Lower autonomy = more human checkpoints."
            isDark={isDark}
            side="top"
          />
        </h3>
        <div className={t.cardPanel}>
          <AutonomyLadder isDark={isDark} level={workflowAutonomy} />
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <Button
          onClick={() => toast.info('Execute Workflow', {
            description: 'Production: mints a Run with queued → running → step-failed → retrying → succeeded / failed / cancelled / awaiting-approval lifecycle. Inspector shows step-level state, retry policy, and dead-letter queue.',
          })}
          className="flex-1 bg-[#87986a] hover:bg-[#6b7a54] text-white text-xs h-9"
        >
          <Play className="h-3.5 w-3.5 mr-1.5" />
          Execute Workflow
        </Button>
        <Button
          onClick={() => toast.info('Schedule Workflow', {
            description: 'Production: cron-based recurring runs, fiscal-day + holiday-calendar aware. Supports per-run overrides and skip-this-cycle.',
          })}
          variant="outline"
          className={`text-xs h-9 ${isDark ? 'border-gray-700 text-gray-300 hover:bg-gray-800' : ''}`}
        >
          <CalendarClock className="h-3.5 w-3.5 mr-1.5" />
          Schedule
        </Button>
        <Button
          onClick={() => toast.info('Clone Template', {
            description: 'Production: forks this workflow as a new draft, version tracked, requires Publish + approver sign-off before deploy.',
          })}
          variant="outline"
          className={`text-xs h-9 ${isDark ? 'border-gray-700 text-gray-300 hover:bg-gray-800' : ''}`}
        >
          <Copy className="h-3.5 w-3.5 mr-1.5" />
          Clone
        </Button>
      </div>
    </div>
  );
}
