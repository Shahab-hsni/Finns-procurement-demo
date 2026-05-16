import { useState, useCallback, useEffect } from 'react';
import { Search, ChevronDown, ChevronRight, HelpCircle } from 'lucide-react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { Input } from '../ui/input';
import { InfoTooltip } from '../ui/InfoTooltip';
import { agents, dagStages } from '../../lib/mockData';
import { useHeartbeat } from '../../hooks/useHeartbeat';
import { useConstraints } from '../../hooks/useConstraints';
import { theme } from '../../lib/theme';
import type { AgentClass } from '../../lib/types';

const TOUR_STORAGE_KEY = 'buyamia-nc-tour-seen';

function createTour() {
  return driver({
    showProgress: true,
    animate: true,
    overlayOpacity: 0.55,
    stagePadding: 8,
    steps: [
      {
        element: '#nc-left-panel',
        popover: {
          title: '👋 What is this page?',
          description: "This is your AI workforce control room. Every AI agent running on the platform is listed here, grouped by what type of job it does — sensing market signals, making decisions, placing orders, enforcing rules, and self-monitoring. Click any group name to filter the whole page to just that team.",
          side: 'right',
        },
      },
      {
        element: '#nc-system-status',
        popover: {
          title: '📊 Two Live Health Meters',
          description: "Health tells you how many agents are currently working correctly. Stress tells you how hard the whole system is being pushed right now. If stress climbs too high, a warning banner appears in the center with a 'Cool Down' button to slow things down before anything breaks.",
          side: 'right',
        },
      },
      {
        element: '#nc-dag-kernel',
        popover: {
          title: '🧠 The 12-Step Purchase Brain',
          description: "Every purchase your platform handles travels through these 12 steps in order — from spotting a need all the way to closing the invoice. Green means running smoothly. Red means a backlog is forming. Click any step to see exactly what's happening inside and take direct action.",
          side: 'bottom',
        },
      },
      {
        element: '#nc-live-metrics',
        popover: {
          title: '📈 Live Numbers',
          description: "Real-time counters showing what the whole system is doing right now — active agent count, decision speed, and how much money is being handled automatically. When you click a team on the left, these numbers switch to show just that team's performance.",
          side: 'top',
        },
      },
      {
        element: '#nc-autonomy-cap',
        popover: {
          title: '🎛️ Your Master Override',
          description: "This is the most powerful control on the page. It sets how much the AI is trusted to decide on its own — slide left to require more human sign-off on every action, slide right to let it run more independently. In an emergency, sliding all the way left puts a human checkpoint on everything immediately.",
          side: 'top',
        },
      },
      {
        element: '#nc-intel-header',
        popover: {
          title: '🤖 Atlas — Watching Your Workforce',
          description: "Atlas monitors your entire AI workforce in real time. It flags agents that are struggling, predicts where the next slowdown will form, and recommends whether to speed up, slow down, or move work between teams.",
          side: 'left',
        },
      },
    ],
  });
}

// Agents that process Stage 1 (Signal Intake) — affected by hard-locked signal sensitivity
const SIGNAL_INTAKE_AGENTS = new Set(['SEN-001', 'SEN-002', 'SEN-003']);

interface AgentGridProps {
  isDark: boolean;
  selectedClass: AgentClass | null;
  onClassSelect: (cls: AgentClass | null) => void;
  systemStress: number;
}

const COHORT_CONFIG: Record<AgentClass, { label: string; abbr: string; badgeDark: string; badgeLight: string }> = {
  sensing:    { label: 'Sensing',    abbr: 'SEN', badgeDark: 'bg-blue-500/15 text-blue-400 border-blue-500/20',     badgeLight: 'bg-blue-50 text-blue-700 border-blue-200' },
  reasoning:  { label: 'Reasoning',  abbr: 'REA', badgeDark: 'bg-purple-500/15 text-purple-400 border-purple-500/20', badgeLight: 'bg-purple-50 text-purple-700 border-purple-200' },
  execution:  { label: 'Execution',  abbr: 'EXE', badgeDark: 'bg-green-500/15 text-green-400 border-green-500/20',   badgeLight: 'bg-green-50 text-green-700 border-green-200' },
  governance: { label: 'Governor',   abbr: 'GOV', badgeDark: 'bg-amber-500/15 text-amber-400 border-amber-500/20',   badgeLight: 'bg-amber-50 text-amber-700 border-amber-200' },
  meta:       { label: 'Metrology',  abbr: 'MET', badgeDark: 'bg-pink-500/15 text-pink-400 border-pink-500/20',      badgeLight: 'bg-pink-50 text-pink-700 border-pink-200' },
};

const ALL_CLASSES: AgentClass[] = ['sensing', 'reasoning', 'execution', 'governance', 'meta'];

// Used for contextual stress text only (stress value comes from parent)
const BOTTLENECK_COUNT = dagStages.filter(s => s.status === 'bottleneck').length;
const WAITING_COUNT    = dagStages.filter(s => s.status === 'waiting').length;

function SystemStatusBar({ isDark, stress }: { isDark: boolean; stress: number }) {
  const t = theme(isDark);

  const govAgents = agents.filter(a => a.class === 'governance');
  const metAgents = agents.filter(a => a.class === 'meta');
  const govActive = govAgents.filter(a => a.status === 'active').length;
  const metActive = metAgents.filter(a => a.status === 'active').length;
  const healthPct = Math.round(((govActive + metActive) / (govAgents.length + metAgents.length)) * 100);

  const healthColor = healthPct >= 90 ? '#22c55e' : healthPct >= 75 ? '#f59e0b' : '#ef4444';
  // Mirror the banner thresholds: green < 70, amber 70–85, red > 85
  const stressColor = stress < 70 ? '#22c55e' : stress < 85 ? '#f59e0b' : '#ef4444';

  const stressLabel = stress >= 85
    ? `${BOTTLENECK_COUNT} bottleneck · ${WAITING_COUNT} waiting — Cool Down suggested`
    : stress >= 70
      ? `${BOTTLENECK_COUNT} bottleneck · ${WAITING_COUNT} waiting — monitor closely`
      : 'Pipeline operating within normal range';

  return (
    <div className={`mx-4 mb-3 p-3 rounded-lg border ${isDark ? 'bg-[#1e221d] border-[#2a3a2a]' : 'bg-[#f4f6f0] border-[#dbe3ce]'}`}>
      {/* Health row */}
      <div className="mb-2.5">
        <div className="flex items-center justify-between mb-1">
          <span className={`text-[10px] font-semibold tracking-wider ${t.textMuted}`}>SYSTEM HEALTH</span>
          <span className="text-xs font-bold tabular-nums" style={{ color: healthColor }}>{healthPct}%</span>
        </div>
        <div className={`h-1.5 rounded-full ${t.progressTrack}`}>
          <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${healthPct}%`, backgroundColor: healthColor }} />
        </div>
        <div className="flex items-center gap-4 mt-1">
          <span className={`text-[10px] ${t.textMuted}`}>GOV <span className={`font-semibold tabular-nums ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>{govActive}/{govAgents.length}</span></span>
          <span className={`text-[10px] ${t.textMuted}`}>MET <span className={`font-semibold tabular-nums ${isDark ? 'text-pink-400' : 'text-pink-600'}`}>{metActive}/{metAgents.length}</span></span>
          <span className={`ml-auto text-[10px] ${t.textMuted}`}>{agents.filter(a => a.status === 'active').length}/{agents.length} total</span>
        </div>
      </div>

      <div className={`h-px mb-2.5 ${isDark ? 'bg-gray-700/40' : 'bg-gray-200'}`} />

      {/* Stress row */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className={`text-[10px] font-semibold tracking-wider ${t.textMuted}`}>SYSTEM STRESS</span>
          <span className="text-xs font-bold tabular-nums" style={{ color: stressColor }}>{stress}%</span>
        </div>
        {/* Bar with 85% threshold marker */}
        <div className="relative">
          <div className={`h-1.5 rounded-full ${t.progressTrack}`}>
            <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${stress}%`, backgroundColor: stressColor }} />
          </div>
          <div
            className={`absolute top-0 h-1.5 w-px ${isDark ? 'bg-gray-500/60' : 'bg-gray-400/60'}`}
            style={{ left: '85%' }}
            title="Cool Down threshold"
          />
        </div>
        <p className={`text-[10px] mt-1 ${stress >= 85 ? isDark ? 'text-red-400/80' : 'text-red-500' : t.textMuted}`}>
          {stressLabel}
        </p>
      </div>
    </div>
  );
}

export function AgentGrid({ isDark, selectedClass, onClassSelect, systemStress }: AgentGridProps) {
  const t = theme(isDark);
  const pulse = useHeartbeat(1200);
  const constraints = useConstraints();
  const signalSensitivityLocked = (constraints.get('signal-sensitivity') ?? 0) >= 90;
  const [search, setSearch] = useState('');
  const [expandedCohorts, setExpandedCohorts] = useState<Set<AgentClass>>(new Set(ALL_CLASSES));

  const startTour = useCallback(() => {
    createTour().drive();
  }, []);

  useEffect(() => {
    if (localStorage.getItem(TOUR_STORAGE_KEY)) return;
    localStorage.setItem(TOUR_STORAGE_KEY, 'true');
    const timer = setTimeout(() => startTour(), 600);
    return () => clearTimeout(timer);
  }, [startTour]);

  const handleCohortClick = (cls: AgentClass) => {
    if (selectedClass === cls) {
      onClassSelect(null);
    } else {
      onClassSelect(cls);
      setExpandedCohorts(prev => { const next = new Set(prev); next.add(cls); return next; });
    }
  };

  const toggleExpand = (cls: AgentClass) => {
    setExpandedCohorts(prev => {
      const next = new Set(prev);
      if (next.has(cls)) next.delete(cls); else next.add(cls);
      return next;
    });
  };

  const statusDot = (status: string) => {
    if (status === 'active') return 'bg-green-500';
    if (status === 'idle')   return 'bg-amber-500';
    return 'bg-red-500';
  };

  return (
    <div id="nc-left-panel" className="flex flex-col h-full">
      {/* Header */}
      <div className={t.section}>
        <div className="flex items-center justify-between mb-3">
          <h2 className={`text-sm font-semibold flex items-center gap-1.5 ${t.textPrimary}`}>
            Labor
            <InfoTooltip
              text="Your AI workforce — every agent grouped by job type. Click a group name to filter the whole page to that team."
              isDark={isDark}
              side="bottom"
            />
          </h2>
          <div className="flex items-center gap-2">
            {selectedClass && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${isDark ? 'bg-[#87986a]/15 text-[#a3b085]' : 'bg-[#f4f6f0] text-[#6b7a54]'}`}>
                {selectedClass} filtered
              </span>
            )}
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
        </div>
        <div className="relative">
          <Search className={t.searchIcon} />
          <Input
            placeholder="Search agents..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={t.searchInput}
          />
        </div>
      </div>

      {/* System Status Gauges */}
      <div id="nc-system-status" className="pt-3">
        <SystemStatusBar isDark={isDark} stress={systemStress} />
      </div>

      {/* Cohort sections */}
      <div id="nc-agent-cohorts" className="flex-1 min-h-0 overflow-auto px-4 pb-4 space-y-1">
        {ALL_CLASSES.map(cls => {
          const cfg = COHORT_CONFIG[cls];
          const cohortAgents = agents.filter(a => {
            if (a.class !== cls) return false;
            if (search && !a.id.toLowerCase().includes(search.toLowerCase()) && !a.description.toLowerCase().includes(search.toLowerCase())) return false;
            return true;
          });
          if (cohortAgents.length === 0 && search) return null;

          const activeCount = cohortAgents.filter(a => a.status === 'active').length;
          const isExpanded = expandedCohorts.has(cls);
          const isSelected = selectedClass === cls;
          const isDimmed = selectedClass !== null && !isSelected;
          const badgeClass = isDark ? cfg.badgeDark : cfg.badgeLight;

          return (
            <div key={cls} className={`transition-opacity ${isDimmed ? 'opacity-40' : 'opacity-100'}`}>
              {/* Cohort header row */}
              <div className={`flex items-center gap-1 rounded-lg mb-1 ${
                isSelected
                  ? isDark ? 'bg-[#87986a]/12 border border-[#87986a]/20' : 'bg-[#f4f6f0] border border-[#dbe3ce]'
                  : ''
              }`}>
                {/* Expand/collapse toggle */}
                <button
                  onClick={() => toggleExpand(cls)}
                  className={`p-1.5 rounded-lg shrink-0 transition-colors ${isDark ? 'hover:bg-[#2a2a2a]' : 'hover:bg-gray-100'}`}
                >
                  {isExpanded
                    ? <ChevronDown className={`w-3 h-3 ${isSelected ? isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]' : t.textMuted}`} />
                    : <ChevronRight className={`w-3 h-3 ${isSelected ? isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]' : t.textMuted}`} />
                  }
                </button>

                {/* Class filter button */}
                <button
                  onClick={() => handleCohortClick(cls)}
                  className="flex-1 flex items-center gap-2 py-1.5 pr-2 text-left"
                  title={isSelected ? `Clear ${cfg.abbr} filter` : `Filter by ${cfg.label} class`}
                >
                  <span className={`px-1.5 py-0.5 rounded text-[10px] border font-mono ${badgeClass}`}>{cfg.abbr}</span>
                  <span className={`text-xs font-medium ${isSelected ? isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]' : t.textPrimary}`}>{cfg.label}</span>
                  <span className={`ml-auto text-[10px] tabular-nums ${t.textMuted}`}>{activeCount}/{cohortAgents.length}</span>
                </button>
              </div>

              {/* Agent cards */}
              {isExpanded && (
                <div className="space-y-1 pl-2 mb-1">
                  {cohortAgents.map(agent => (
                    <div key={agent.id} className={`p-2.5 rounded-lg border ${isDark ? 'bg-[#1e1e1e] border-gray-800' : 'bg-white border-gray-200'}`}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="relative shrink-0">
                            <div className={`w-2 h-2 rounded-full ${statusDot(agent.status)}`} />
                            {agent.status === 'active' && pulse && (
                              <div className={`absolute inset-0 w-2 h-2 rounded-full ${statusDot(agent.status)} opacity-40 animate-ping`} />
                            )}
                          </div>
                          <span className={`text-xs font-mono font-medium ${t.textPrimary}`}>{agent.id}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] ${t.textMuted}`}>{agent.tier}</span>
                          <span className={`text-[10px] tabular-nums ${t.textMuted}`}>{agent.tasksCompleted.toLocaleString()}t</span>
                        </div>
                      </div>
                      <div className={`text-[10px] truncate mb-0.5 ${t.textMuted}`}>↳ {agent.lastAction}</div>
                      <div className={`text-[10px] truncate font-medium ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}>◉ {agent.currentFocus}</div>
                      {signalSensitivityLocked && SIGNAL_INTAKE_AGENTS.has(agent.id) && (
                        <div className={`mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                          isDark ? 'bg-amber-500/10 text-amber-300 border-amber-500/25' : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          👤 User Constrained · Signal Sensitivity {constraints.get('signal-sensitivity')}%
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
