import { useState } from 'react';
import { agents } from '../../lib/mockData';
import { useHeartbeat } from '../../hooks/useHeartbeat';
import { theme } from '../../lib/theme';
import type { AgentClass } from '../../lib/types';

interface AgentClassSheetProps {
  cls: AgentClass;
  isDark: boolean;
  onClose: () => void;
}

const COHORT_CONFIG: Record<AgentClass, { label: string; abbr: string; description: string; badgeDark: string; badgeLight: string }> = {
  sensing:    { label: 'Sensing',    abbr: 'SEN', description: 'Market Intelligence · Feed Ingestion · Signal Detection', badgeDark: 'bg-blue-500/15 text-blue-400 border-blue-500/20',     badgeLight: 'bg-blue-50 text-blue-700 border-blue-200' },
  reasoning:  { label: 'Reasoning',  abbr: 'REA', description: 'Forecasting · Risk Scoring · Price Optimization',         badgeDark: 'bg-purple-500/15 text-purple-400 border-purple-500/20', badgeLight: 'bg-purple-50 text-purple-700 border-purple-200' },
  execution:  { label: 'Execution',  abbr: 'EXE', description: 'Order Generation · Payment Processing · Fulfillment',     badgeDark: 'bg-green-500/15 text-green-400 border-green-500/20',   badgeLight: 'bg-green-50 text-green-700 border-green-200' },
  governance: { label: 'Governor',   abbr: 'GOV', description: 'Policy Enforcement · Compliance · Audit Trail',           badgeDark: 'bg-amber-500/15 text-amber-400 border-amber-500/20',   badgeLight: 'bg-amber-50 text-amber-700 border-amber-200' },
  meta:       { label: 'Metrology',  abbr: 'MET', description: 'Orchestration · System Health · Performance',             badgeDark: 'bg-pink-500/15 text-pink-400 border-pink-500/20',      badgeLight: 'bg-pink-50 text-pink-700 border-pink-200' },
};

const agentNumber = (id: string) => agents.findIndex(a => a.id === id) + 1;

export function AgentClassSheet({ cls, isDark, onClose }: AgentClassSheetProps) {
  const t = theme(isDark);
  const pulse = useHeartbeat(1200);
  const [recalibrating, setRecalibrating] = useState(false);

  const cfg = COHORT_CONFIG[cls];
  const classAgents = agents.filter(a => a.class === cls);
  const activeCount = classAgents.filter(a => a.status === 'active').length;
  const avgUptime = (classAgents.reduce((sum, a) => sum + a.uptime, 0) / classAgents.length).toFixed(1);
  const badgeClass = isDark ? cfg.badgeDark : cfg.badgeLight;
  const healthPct = Math.round((activeCount / classAgents.length) * 100);

  const statusDot = (status: string) => {
    if (status === 'active') return 'bg-green-500';
    if (status === 'idle')   return 'bg-amber-500';
    return 'bg-red-500';
  };

  const handleRecalibrate = () => {
    setRecalibrating(true);
    setTimeout(() => setRecalibrating(false), 2500);
  };

  return (
    <div className={`flex flex-col h-full ${isDark ? 'bg-[#1a1a1a]' : 'bg-white border-l border-gray-200'}`}>
      {/* Header */}
      <div className={`p-4 border-b ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
        <div className="flex items-center gap-2 mb-1">
          <button
            onClick={onClose}
            className={`text-[10px] px-2 py-0.5 rounded transition-colors ${isDark ? 'text-gray-500 hover:text-gray-300 hover:bg-gray-800' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
          >
            ← Atlas
          </button>
          <span className={`px-1.5 py-0.5 rounded text-[10px] border font-mono ${badgeClass}`}>{cfg.abbr}</span>
          <h2 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{cfg.label} Class</h2>
        </div>
        <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{cfg.description}</p>
      </div>

      {/* Employment stats */}
      <div className={`px-4 pt-4 pb-3 border-b ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
        <div className="flex gap-6 mb-3">
          <div>
            <div className={`text-2xl font-bold tabular-nums ${isDark ? 'text-white' : 'text-gray-900'}`}>{activeCount}/{classAgents.length}</div>
            <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Employed</div>
          </div>
          <div>
            <div className={`text-2xl font-bold tabular-nums ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}>{avgUptime}%</div>
            <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Avg Uptime</div>
          </div>
        </div>
        <div className={`h-1.5 rounded-full ${t.progressTrack}`}>
          <div
            className="h-full rounded-full transition-all duration-1000"
            style={{ width: `${healthPct}%`, backgroundColor: healthPct === 100 ? '#22c55e' : '#f59e0b' }}
          />
        </div>
      </div>

      {/* Agent roster */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2">
        {classAgents.map(agent => {
          const num = agentNumber(agent.id);
          return (
            <div key={agent.id} className={`p-2.5 rounded-lg border ${isDark ? 'bg-[#1e1e1e] border-gray-800' : 'bg-gray-50 border-gray-200'}`}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="relative shrink-0">
                    <div className={`w-2 h-2 rounded-full ${statusDot(agent.status)}`} />
                    {agent.status === 'active' && pulse && (
                      <div className={`absolute inset-0 w-2 h-2 rounded-full ${statusDot(agent.status)} opacity-40 animate-ping`} />
                    )}
                  </div>
                  <span className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    Agent #{num}
                  </span>
                  <span className={`text-[10px] font-mono ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    ({agent.id})
                  </span>
                </div>
                <span className={`text-[10px] shrink-0 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>{agent.tier}</span>
              </div>
              <div className={`text-[10px] truncate mb-0.5 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                ↳ {agent.lastAction}
              </div>
              <div className={`text-[10px] truncate font-medium ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}>
                ◉ {agent.currentFocus}
              </div>
            </div>
          );
        })}
      </div>

      {/* Re-calibrate */}
      <div className={`p-4 border-t ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
        <button
          onClick={handleRecalibrate}
          disabled={recalibrating}
          className={`w-full py-2.5 rounded-xl text-sm font-medium transition-all ${
            recalibrating
              ? isDark ? 'bg-[#87986a]/20 text-[#a3b085]/60 cursor-not-allowed' : 'bg-[#dbe3ce] text-[#6b7a54]/60 cursor-not-allowed'
              : isDark ? 'bg-[#87986a]/15 border border-[#87986a]/20 text-[#a3b085] hover:bg-[#87986a]/25' : 'bg-[#f4f6f0] border border-[#dbe3ce] text-[#6b7a54] hover:bg-[#ebeee4]'
          }`}
        >
          {recalibrating ? '⟳ Re-calibrating...' : `Re-calibrate ${cfg.abbr} Class Logic`}
        </button>
      </div>
    </div>
  );
}
