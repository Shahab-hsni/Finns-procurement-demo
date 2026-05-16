import { useState, useCallback, useEffect } from 'react';
import {
  Zap, FileText, Users, AlertCircle,
  Factory, Wrench, Building2, Radio, Search, ScrollText, HelpCircle,
} from 'lucide-react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { Input } from '../ui/input';
import { InfoTooltip } from '../ui/InfoTooltip';
import { workflowTemplates, demandSignals } from '../../lib/mockData';
import { useHeartbeat } from '../../hooks/useHeartbeat';
import { theme } from '../../lib/theme';
import type { DemandSignal } from '../../lib/types';

const TOUR_STORAGE_KEY = 'buyamia-wf-tour-seen';

function createTour() {
  return driver({
    showProgress: true,
    animate: true,
    overlayOpacity: 0.55,
    stagePadding: 8,
    steps: [
      {
        element: '#wf-left-panel',
        popover: {
          title: '👋 What is this page?',
          description: "This is your library of purchase playbooks. Each card is a different type of purchase your AI knows how to run — from routine supply orders to complex capital equipment deals. Click any card to see exactly how it works, step by step.",
          side: 'right',
        },
      },
      {
        element: '#wf-demand-signals',
        popover: {
          title: '📡 Live Market Signals',
          description: "These are early warnings that something might need ordering soon — pulled from sales data, seasonal patterns, and usage trends. Click any signal to watch it trace its path through the purchase steps below.",
          side: 'right',
        },
      },
      {
        element: '#wf-workflow-hero',
        popover: {
          title: '📋 The Selected Playbook',
          description: "This card shows the purchase process you've chosen: how many orders are currently running through it, how long they typically take, and how much money it has saved. Hit 'Simulate' to test what would happen under a heavy load.",
          side: 'bottom',
        },
      },
      {
        element: '#wf-flow-path',
        popover: {
          title: '🗺️ Step-by-Step Purchase Map',
          description: "This is the full route your AI takes — from detecting a need all the way to paying the invoice. Each row is one step, showing which AI agents are handling it. Click 'Tune Logic' on any step to make the AI stricter or more relaxed at that point.",
          side: 'top',
        },
      },
      {
        element: '#wf-autonomy',
        popover: {
          title: '🎚️ How Much Can the AI Decide Alone?',
          description: "This shows the trust level for this type of purchase. Routine, low-risk orders can run fully automatically. High-value or unusual purchases require your approval before the AI takes action.",
          side: 'top',
        },
      },
      {
        element: '#wf-intel-header',
        popover: {
          title: '🤖 Atlas — Your Workflow Architect',
          description: "Atlas monitors all running orders, flags slowdowns before they become problems, and can run 'what if' simulations to show you exactly where a bottleneck would appear if things get busy.",
          side: 'left',
        },
      },
    ],
  });
}

interface WorkflowTemplateListProps {
  isDark: boolean;
  selectedWorkflow: string | null;
  onSelectWorkflow: (id: string) => void;
  selectedSignalId: string | null;
  onSignalSelect: (id: string | null) => void;
}

const WORKFLOW_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  FileText, Zap, ScrollText, Users, AlertCircle, Factory, Wrench, Building2,
};

const COMPLEXITY_BADGE_DARK: Record<string, string> = {
  simple:  'bg-green-500/15 text-green-400 border-green-500/20',
  medium:  'bg-amber-500/15 text-amber-400 border-amber-500/20',
  complex: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
};
const COMPLEXITY_BADGE_LIGHT: Record<string, string> = {
  simple:  'bg-green-50 text-green-700 border-green-200',
  medium:  'bg-amber-50 text-amber-700 border-amber-200',
  complex: 'bg-purple-50 text-purple-700 border-purple-200',
};

const COMPLEXITY_SELECTED_DARK: Record<string, string> = {
  simple:  'bg-green-500/10 border-green-500/35',
  medium:  'bg-amber-500/10 border-amber-500/35',
  complex: 'bg-purple-500/10 border-purple-500/35',
};
const COMPLEXITY_SELECTED_LIGHT: Record<string, string> = {
  simple:  'bg-green-50 border-green-300',
  medium:  'bg-amber-50 border-amber-300',
  complex: 'bg-purple-50 border-purple-300',
};

const COMPLEXITY_ICON_SELECTED_DARK: Record<string, string> = {
  simple:  'text-green-400',
  medium:  'text-amber-400',
  complex: 'text-purple-400',
};
const COMPLEXITY_ICON_SELECTED_LIGHT: Record<string, string> = {
  simple:  'text-green-600',
  medium:  'text-amber-600',
  complex: 'text-purple-600',
};

const WORKFLOW_PERF: Record<string, { active: number; avgTime: string; savings: string }> = {
  'WF-STD': { active: 124, avgTime: '5.8d',  savings: '$18.4K' },
  'WF-RSH': { active: 31,  avgTime: '38h',   savings: '$3.2K'  },
  'WF-BPO': { active: 8,   avgTime: '18d',   savings: '$42.1K' },
  'WF-GRP': { active: 12,  avgTime: '9d',    savings: '$11.8K' },
  'WF-EMR': { active: 7,   avgTime: '3.5h',  savings: '$1.4K'  },
  'WF-PRD': { active: 22,  avgTime: '4.2d',  savings: '$28.9K' },
  'WF-MNT': { active: 14,  avgTime: '4.1d',  savings: '$5.3K'  },
  'WF-CPX': { active: 4,   avgTime: '28d',   savings: '$63.7K' },
};

// ── Deterministic sparkline ─────────────────────────────────────
function seededRandom(seed: number): number {
  const s = Math.sin(seed * 9301 + 49297) * 233280;
  return s - Math.floor(s);
}
function signalHistory(signal: DemandSignal): number[] {
  const base = signal.strength;
  const s = signal.id.charCodeAt(signal.id.length - 1);
  return Array.from({ length: 12 }, (_, i) => {
    const r = seededRandom(s + i * 0.7);
    return Math.max(5, Math.min(100, base + (r - 0.5) * 26));
  });
}
function SparklineSvg({ values, color }: { values: number[]; color: string }) {
  const W = 56, H = 16, n = values.length;
  if (n < 2) return null;
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (n - 1)) * W;
    const y = H - ((v - min) / span) * (H - 3) - 1.5;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="overflow-visible shrink-0">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Stage wiring (union of all related-workflow stages) ─────────
function getSignalStageLabel(signal: DemandSignal): string {
  const stageSet = new Set<number>();
  signal.relatedWorkflows.forEach(wfId => {
    const wf = workflowTemplates.find(w => w.id === wfId);
    if (wf) wf.stages.forEach(s => stageSet.add(s));
  });
  const sorted = Array.from(stageSet).sort((a, b) => a - b);
  return sorted.map(s => `S${s}`).join(' · ');
}

// ── Correlation: signals sharing a relatedWorkflow ──────────────
function getCorrelatedNames(signal: DemandSignal): string[] {
  const myWf = new Set(signal.relatedWorkflows);
  return demandSignals
    .filter(s => s.id !== signal.id && s.strength > 70 && s.relatedWorkflows.some(wf => myWf.has(wf)))
    .map(s => s.name);
}

// ── Active correlation groups for banner ───────────────────────
const WF_SHORT: Record<string, string> = {
  'WF-STD': 'Standard', 'WF-RSH': 'Rush', 'WF-BPO': 'Blanket PO',
  'WF-GRP': 'Group Buy', 'WF-EMR': 'Emergency', 'WF-PRD': 'Production',
  'WF-MNT': 'Maintenance', 'WF-CPX': 'Capex',
};
function getActiveCorrelationGroups() {
  const groups = new Map<string, DemandSignal[]>();
  for (const signal of demandSignals) {
    if (signal.strength <= 70) continue;
    for (const wfId of signal.relatedWorkflows) {
      if (!groups.has(wfId)) groups.set(wfId, []);
      groups.get(wfId)!.push(signal);
    }
  }
  return Array.from(groups.entries())
    .filter(([, sigs]) => sigs.length >= 2)
    .map(([wfId, signals]) => ({ wfId, signals }))
    .slice(0, 3);
}

export function WorkflowTemplateList({
  isDark,
  selectedWorkflow,
  onSelectWorkflow,
  selectedSignalId,
  onSignalSelect,
}: WorkflowTemplateListProps) {
  const t = theme(isDark);
  const pulse = useHeartbeat(1500);
  const [search, setSearch] = useState('');

  const startTour = useCallback(() => {
    createTour().drive();
  }, []);

  useEffect(() => {
    if (localStorage.getItem(TOUR_STORAGE_KEY)) return;
    localStorage.setItem(TOUR_STORAGE_KEY, 'true');
    const timer = setTimeout(() => startTour(), 600);
    return () => clearTimeout(timer);
  }, [startTour]);
  const complexityBadge = isDark ? COMPLEXITY_BADGE_DARK : COMPLEXITY_BADGE_LIGHT;

  const filteredWorkflows = workflowTemplates.filter(
    w => !search || w.name.toLowerCase().includes(search.toLowerCase())
  );
  const filteredSignals = demandSignals.filter(
    s => !search || s.name.toLowerCase().includes(search.toLowerCase())
  );
  const correlationGroups = getActiveCorrelationGroups();
  const complexitySelected = isDark ? COMPLEXITY_SELECTED_DARK : COMPLEXITY_SELECTED_LIGHT;
  const complexityIconSelected = isDark ? COMPLEXITY_ICON_SELECTED_DARK : COMPLEXITY_ICON_SELECTED_LIGHT;

  return (
    <div id="wf-left-panel" className="flex flex-col h-full">
      {/* Header + Search */}
      <div className={t.section}>
        <div className="flex items-center justify-between mb-3">
          <h2 className={`text-sm font-semibold flex items-center gap-1.5 ${t.textPrimary}`}>
            Workflows
            <InfoTooltip
              text="A library of purchase playbooks — each one is a recipe your AI follows to handle a different type of order."
              isDark={isDark}
              side="bottom"
            />
          </h2>
          <button
            onClick={startTour}
            className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded border transition-colors shrink-0 ${
              isDark
                ? 'border-gray-700 text-gray-400 hover:border-[#87986a]/50 hover:text-[#a3b085]'
                : 'border-gray-200 text-gray-500 hover:border-[#87986a]/50 hover:text-[#6b7a54]'
            }`}
          >
            <HelpCircle className="h-3 w-3" />
            Take a tour
          </button>
        </div>
        <div className="relative">
          <Search className={t.searchIcon} />
          <Input
            placeholder="Search workflows & signals..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={t.searchInput}
          />
        </div>
      </div>

      {/* Workflow Templates */}
      <div id="wf-templates" className={t.section}>
        <h3 className={`text-xs mb-3 flex items-center gap-1.5 ${t.sectionLabel}`}>
          TEMPLATES
          <InfoTooltip
            text="Each template is a pre-built process for a specific type of purchase. Click one to load it in the center panel."
            isDark={isDark}
            side="right"
          />
        </h3>
        <div className="space-y-2">
          {filteredWorkflows.map(wf => {
            const Icon = WORKFLOW_ICONS[wf.icon] || FileText;
            const isSelected = selectedWorkflow === wf.id;
            const perf = WORKFLOW_PERF[wf.id];
            return (
              <button
                key={wf.id}
                onClick={() => onSelectWorkflow(wf.id)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  isSelected
                    ? complexitySelected[wf.complexity]
                    : isDark ? 'bg-[#2a2a2a] border-gray-800 hover:bg-gray-800' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icon className={`h-4 w-4 shrink-0 ${isSelected ? complexityIconSelected[wf.complexity] : t.textSecondary}`} />
                  <span className={`text-xs font-semibold ${t.textPrimary}`}>{wf.name}</span>
                  <span className={`ml-auto px-1.5 py-0.5 rounded text-[10px] border ${complexityBadge[wf.complexity]}`}>{wf.complexity}</span>
                </div>
                <p className={`text-[10px] mb-2 line-clamp-1 ${t.textMuted}`}>{wf.description}</p>
                {perf && (
                  <div className={`flex rounded-md overflow-hidden border text-[10px] ${isDark ? 'border-gray-700/60' : 'border-gray-200'}`}>
                    <div className={`flex-1 px-2 py-1 text-center border-r ${isDark ? 'border-gray-700/60 bg-[#1a1a1a]' : 'border-gray-200 bg-white'}`}>
                      <div className={`font-bold tabular-nums ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}>{perf.active}</div>
                      <div className={t.textMuted}>active</div>
                    </div>
                    <div className={`flex-1 px-2 py-1 text-center border-r ${isDark ? 'border-gray-700/60 bg-[#1a1a1a]' : 'border-gray-200 bg-white'}`}>
                      <div className={`font-bold tabular-nums ${t.textPrimary}`}>{perf.avgTime}</div>
                      <div className={t.textMuted}>avg time</div>
                    </div>
                    <div className={`flex-1 px-2 py-1 text-center ${isDark ? 'bg-[#1a1a1a]' : 'bg-white'}`}>
                      <div className={`font-bold tabular-nums ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{perf.savings}</div>
                      <div className={t.textMuted}>saved</div>
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Demand Signals */}
      <div id="wf-demand-signals" className="px-4 pb-4">
        <div className="flex items-center gap-2 mb-1">
          <h3 className={`text-xs flex items-center gap-1.5 ${t.sectionLabel}`}>
            DEMAND SIGNALS
            <InfoTooltip
              text="Live early-warning indicators that a product may need ordering soon. Click one to trace its path through the purchase steps."
              isDark={isDark}
              side="right"
            />
          </h3>
          {selectedSignalId && (
            <button
              onClick={() => onSignalSelect(null)}
              className={`ml-auto text-[10px] underline ${t.textMuted}`}
            >
              clear
            </button>
          )}
        </div>
        <p className={`text-[10px] mb-2 ${t.textMuted}`}>Click a signal to trace its path through the DAG</p>

        {/* Active Correlation Banner */}
        {correlationGroups.length > 0 && (
          <div className={`mb-3 p-2.5 rounded-lg border text-[10px] ${
            isDark ? 'bg-[#87986a]/8 border-[#87986a]/25' : 'bg-[#f4f6f0] border-[#dbe3ce]'
          }`}>
            <div className={`font-semibold mb-1 ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}>⟷ Simultaneous signals</div>
            {correlationGroups.map(({ wfId, signals }) => (
              <div key={wfId} className={`text-[10px] ${t.textMuted}`}>
                {WF_SHORT[wfId] ?? wfId} ← {signals.map(s => s.name).join(' + ')}
              </div>
            ))}
          </div>
        )}

        <div className="space-y-1.5">
          {filteredSignals.map(signal => {
            const isSelected = selectedSignalId === signal.id;
            const history = signalHistory(signal);
            const sparkColor = signal.strength > 70 ? '#22c55e' : signal.strength > 40 ? '#f59e0b' : '#6b7280';
            const correlated = getCorrelatedNames(signal);
            const stageLabel = getSignalStageLabel(signal);

            return (
              <button
                key={signal.id}
                onClick={() => onSignalSelect(isSelected ? null : signal.id)}
                className={`w-full text-left p-2.5 rounded-lg border transition-colors ${
                  isSelected
                    ? isDark
                      ? 'bg-[#87986a]/12 border-[#87986a]/40'
                      : 'bg-[#f4f6f0] border-[#87986a]/40'
                    : isDark
                      ? 'bg-[#1e1e1e] border-gray-800 hover:border-gray-700'
                      : 'bg-white border-gray-200 hover:border-gray-300'
                }`}
              >
                {/* Top row: radio + name + sparkline */}
                <div className="flex items-center gap-2 mb-1">
                  <div className="relative shrink-0">
                    <Radio className={`h-3 w-3 ${signal.strength > 70 ? 'text-green-400' : signal.strength > 40 ? 'text-amber-400' : 'text-gray-500'}`} />
                    {signal.strength > 70 && pulse && (
                      <div className="absolute -inset-1 rounded-full bg-green-500/20 animate-ping" />
                    )}
                  </div>
                  <span className={`text-xs font-medium flex-1 min-w-0 truncate text-left ${t.textPrimary}`}>{signal.name}</span>
                  <SparklineSvg values={history} color={sparkColor} />
                </div>

                {/* Meta row */}
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-[10px] ${t.textMuted}`}>{signal.source}</span>
                  <span className={`text-[10px] tabular-nums font-medium ${signal.strength > 70 ? isDark ? 'text-green-400' : 'text-green-600' : t.textMuted}`}>{signal.strength}%</span>
                </div>

                {/* Strength bar */}
                <div className={`h-1 rounded-full mb-2 ${t.progressTrack}`}>
                  <div
                    className={`h-1 rounded-full ${isSelected ? 'bg-[#a3b085]' : 'bg-[#87986a]'}`}
                    style={{ width: `${signal.strength}%` }}
                  />
                </div>

                {/* Fixed-height bottom row — always same size, content swaps on selection */}
                <div className="h-[18px] flex items-center gap-1.5 overflow-hidden">
                  {isSelected ? (
                    <span className={`text-[9px] font-medium truncate ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}>
                      ● active · → {stageLabel}
                    </span>
                  ) : (
                    <>
                      <span className={`text-[9px] truncate ${t.textMuted}`}>
                        {signal.relatedWorkflows.join(' · ')}
                      </span>
                      {correlated.length > 0 && (
                        <span className={`shrink-0 text-[9px] ${isDark ? 'text-[#87986a]/60' : 'text-[#87986a]/70'}`}>
                          · ⟷ {correlated[0]}{correlated.length > 1 ? ` +${correlated.length - 1}` : ''}
                        </span>
                      )}
                    </>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
